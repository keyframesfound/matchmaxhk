import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  canPerformStatusAction,
  statusChangeEmailLine,
  STATUS_CHANGE_REASONS,
  type StatusAction,
} from "./account-status.shared";

/**
 * Issue #308: account suspend / ban / restore + block list management.
 *
 * Trust model (follows the repo's settled patterns):
 *  - Role checks run against the CALLER via the `has_role` RPC with the
 *    caller's own auth context (staff/concierge may suspend; ONLY admin /
 *    super_admin may ban or restore). Every function re-checks server-side.
 *  - Writes to profiles / tutors / account_blocklist go through the
 *    service-role client (blocklist has no client policies at all).
 *  - The reason text stored on the profile never names a reporter; the
 *    email contains only the status + community-commitment line.
 *  - Email is best-effort: a missing RESEND_API_KEY or a Resend failure is
 *    logged and skipped, the status change itself must never fail because
 *    of the notification.
 */

type HasRoleClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
};

async function hasAnyRole(
  supabase: unknown,
  userId: string,
  roles: readonly string[],
): Promise<boolean> {
  const client = supabase as HasRoleClient;
  for (const role of roles) {
    const { data } = await client.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return true;
  }
  return false;
}

async function assertStaffOrAdmin(supabase: unknown, userId: string) {
  if (await hasAnyRole(supabase, userId, ["staff", "admin", "super_admin"])) return;
  throw new Error("Forbidden");
}

async function assertAdminOnly(supabase: unknown, userId: string) {
  if (await hasAnyRole(supabase, userId, ["admin", "super_admin"])) return;
  throw new Error("Forbidden");
}

/** Staff can suspend; only admins can ban or restore (issue decision). */
async function assertCanPerformAction(supabase: unknown, userId: string, action: StatusAction) {
  if (!canPerformStatusAction(["staff", "admin", "super_admin"], action)) {
    throw new Error("Forbidden");
  }
  const allowed =
    action === "suspend" ? ["staff", "admin", "super_admin"] : (["admin", "super_admin"] as const);
  if (!(await hasAnyRole(supabase, userId, allowed))) {
    throw new Error("Forbidden");
  }
}

/** Human-facing reason line stored on the profile (shown to the user). */
function buildReasonLine(reason: string, note: string | null | undefined): string {
  const labels: Record<string, string> = {
    contact_details: "Contact details shared",
    inappropriate_photo: "Inappropriate photo",
    spam: "Spam",
    fake_identity: "Fake identity",
    other: "Other",
  };
  const trimmedNote = note?.trim();
  const label = labels[reason] ?? reason;
  return trimmedNote ? `${label}, ${trimmedNote}` : label;
}

async function sendStatusChangeEmail(email: string, action: StatusAction) {
  try {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    await sendTemplateEmail("account-status", email, {
      templateData: { statusLine: statusChangeEmailLine(action) },
    });
  } catch (err) {
    // Degrade gracefully: unset RESEND_API_KEY or a Resend outage must not
    // fail the status change.
    console.error(
      `[account-status] status email not sent (${action}) to ${email}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

export const setAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        action: z.enum(["suspend", "ban", "restore"]),
        reason: z.enum(STATUS_CHANGE_REASONS).optional(),
        note: z.string().trim().max(500).optional().nullable(),
        // Optional link to an existing report (no report id required).
        reportId: z.string().uuid().optional().nullable(),
      })
      .refine((d) => d.action === "restore" || !!d.reason, {
        message: "A reason is required for suspend and ban.",
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertCanPerformAction(context.supabase, context.userId, data.action);

    // Never let an admin lock themselves out of the console.
    if (data.userId === context.userId) {
      throw new Error("You cannot change the status of your own account.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, google_sub, account_status")
      .eq("id", data.userId)
      .maybeSingle();
    if (profileErr) throw new Error(profileErr.message);
    if (!profile) throw new Error("Account not found.");

    const now = new Date().toISOString();
    const reasonLine = data.action === "restore" ? null : buildReasonLine(data.reason!, data.note);

    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update({
        account_status:
          data.action === "suspend" ? "suspended" : data.action === "ban" ? "banned" : "active",
        account_status_reason: reasonLine,
        account_status_at: now,
      })
      .eq("id", data.userId);
    if (updateErr) throw new Error(updateErr.message);

    if (data.action === "ban") {
      // Banned: store the identity on the block list (delete-then-insert;
      // the unique index is on lower(email), which PostgREST's onConflict
      // cannot target for an expression index) and unpublish the card(s).
      const escapeIlike = (value: string) => value.replace(/[\\%_]/g, "\\$&");
      if (profile.email || profile.google_sub) {
        if (profile.email) {
          await supabaseAdmin
            .from("account_blocklist")
            .delete()
            .ilike("email", escapeIlike(profile.email));
        }
        if (profile.google_sub) {
          await supabaseAdmin
            .from("account_blocklist")
            .delete()
            .eq("google_sub", profile.google_sub);
        }
        const { error } = await supabaseAdmin.from("account_blocklist").insert({
          email: profile.email ?? `google-sub:${profile.google_sub}`,
          google_sub: profile.google_sub ?? null,
          note: reasonLine,
          created_by: context.userId,
        });
        if (error) throw new Error(error.message);
      }

      await supabaseAdmin
        .from("tutors")
        .update({ is_published: false, card_hidden_by_ban: true })
        .eq("user_id", data.userId)
        .eq("is_published", true);

      // Server-forced sign-out so the ban takes effect immediately.
      try {
        await supabaseAdmin.auth.admin.signOut(data.userId, "global");
      } catch (err) {
        console.error(
          `[account-status] forced sign-out failed for ${data.userId}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    if (data.action === "restore") {
      // Restore removes the block list entries (issue decision) and
      // republishes exactly the cards this flow had unpublished, never a
      // card the tutor hid themselves before the ban.
      if (profile.email) {
        await supabaseAdmin.from("account_blocklist").delete().ilike("email", profile.email);
      }
      if (profile.google_sub) {
        await supabaseAdmin.from("account_blocklist").delete().eq("google_sub", profile.google_sub);
      }
      await supabaseAdmin
        .from("tutors")
        .update({ is_published: true, card_hidden_by_ban: false })
        .eq("user_id", data.userId)
        .eq("card_hidden_by_ban", true);
    }

    // Suspend keeps the session (the user sees the reason in-app); only ban
    // ends it. Restore never re-authenticates anyone.

    if (profile.email) {
      await sendStatusChangeEmail(profile.email, data.action);
    }

    return {
      ok: true,
      status: data.action === "suspend" ? "suspended" : data.action === "ban" ? "banned" : "active",
    };
  });

export const addAccountBlocklistEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().trim().email(),
        note: z.string().trim().max(500).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOnly(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Block list is for emails WITHOUT an account yet; ban the account
    // instead so the full flow (card unpublish + sign-out) runs.
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", data.email)
      .limit(1);
    if (existing && existing.length > 0) {
      throw new Error("An account with this email exists, ban the account instead.");
    }

    const { error } = await supabaseAdmin.from("account_blocklist").insert({
      email: data.email,
      note: data.note ?? null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type AccountBlocklistRow = {
  id: string;
  email: string;
  google_sub: string | null;
  note: string | null;
  created_at: string;
};

export const listAccountBlocklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({}).parse(data ?? {}))
  .handler(async ({ context }) => {
    await assertAdminOnly(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("account_blocklist")
      .select("id, email, google_sub, note, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { entries: (data ?? []) as AccountBlocklistRow[] };
  });

export const removeAccountBlocklistEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdminOnly(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.from("account_blocklist").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type OpenReportOption = {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  created_at: string;
};

/** Open reports for the optional "link a report" picker (staff and above). */
export const listOpenReportsForStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({}).parse(data ?? {}))
  .handler(async ({ context }) => {
    await assertStaffOrAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // `reports` is intentionally untyped in types.ts (soft-reference table,
    // same structural-client pattern as reports.functions.ts).
    const admin = supabaseAdmin as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (
            col: string,
            value: string,
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => {
              limit: (n: number) => Promise<{
                data: OpenReportOption[] | null;
                error?: { message?: string };
              }>;
            };
          };
        };
      };
    };

    const { data, error } = await admin
      .from("reports")
      .select("id, target_type, target_id, reason, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { reports: data ?? [] };
  });
