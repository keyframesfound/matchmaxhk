/**
 * Issue #561, Action Required notifications: server half.
 *
 * Everything rides the #205 bus: an action item is an in-app
 * `event_deliveries` row with action_required = true, created by the drain
 * from an `action.*` / scenario event (see ACTION_PLAN in action-required.ts).
 * This module owns the lifecycle around it:
 *
 *   * emitActionEvent / emitDirectAction — best-effort event inserts from
 *     completion-triggering flows (fee paid, verification rejected, …).
 *   * completeActionsFor — auto-resolve hooks ("user re-uploaded", "lead
 *     claimed"); resolved items stop reminding immediately.
 *   * runActionReminderSweep — daily 09:00 HKT Nitro task (tasks/action-reminders.ts).
 *   * scanProfileGaps — AR-4 / AR-10 detection (missing critical fields).
 *   * admin Appoint Action tool server fns.
 *
 * Idempotence: the partial unique index `uq_ar_open` on
 * (action_type, recipient, entity) means a second open action for the same
 * (type, entity, user) is a no-op at the delivery layer.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import {
  firstReminderAt,
  reminderAt,
  shouldSendReminder,
  type ActionUrgency,
} from "@/features/cases/action-required";
import { prefsKeyForEmail } from "@/features/cases/bus";

type Row = Record<string, unknown>;
type Db = ReturnType<typeof asAdminDb>;

/**
 * The admin tool resolves users by email with PostgREST ilike, which the
 * asAdminDb subset does not model — the reports module precedent: cast the
 * service-role client to the exact shape this module needs.
 */
type AdminQueryClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (
        col: string,
        value: unknown,
      ) => {
        ilike: (
          col: string,
          value: string,
        ) => {
          maybeSingle: () => Promise<{
            data: Record<string, unknown> | null;
            error?: { message?: string } | null;
          }>;
        };
        maybeSingle: () => Promise<{
          data: Record<string, unknown> | null;
          error?: { message?: string } | null;
        }>;
      };
      ilike: (
        col: string,
        value: string,
      ) => {
        maybeSingle: () => Promise<{
          data: Record<string, unknown> | null;
          error?: { message?: string } | null;
        }>;
      };
    };
  };
};

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

/** Admin tool is staff-only (same gate as the risk-flag desk). */
async function assertStaff(supabase: unknown, userId: string) {
  if (await hasAnyRole(supabase, userId, ["staff", "admin", "super_admin"])) return;
  throw new Error("Forbidden");
}

/**
 * Best-effort insert of a bus event from an emitter (match dispatch, fee
 * payment, credential review…). A failed notification must never fail the
 * business action; duplicates are deduped on (event_type, source_id).
 */
export async function emitActionEvent(
  db: Db,
  eventType: string,
  payload: Record<string, unknown>,
  sourceId: string | null,
): Promise<void> {
  try {
    const { error } = await db
      .from<Row>("case_events")
      .insert({ event_type: eventType, payload, source_id: sourceId })
      .select("id")
      .single();
    if (error && !/duplicate|unique/i.test((error as { message?: string })?.message ?? "")) {
      console.warn(`[action-required] event ${eventType} not recorded`);
    }
  } catch (e) {
    console.warn(
      `[action-required] event ${eventType} not recorded:`,
      e instanceof Error ? e.message : e,
    );
  }
}

/**
 * Emit an action event addressed to one specific account (no case lookup
 * needed): report.filed to the reported owner, admin tasks, profile scans.
 * Recipients resolve from payload.recipient_account_id (role `recipient`).
 */
export async function emitDirectAction(
  db: Db,
  eventType: string,
  recipientAccountId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await emitActionEvent(
    db,
    eventType,
    { ...payload, recipient_account_id: recipientAccountId },
    null,
  );
}

/**
 * Auto-resolve: mark every OPEN action of `actionType` for `entityId`
 * (and optionally one recipient) resolved. #561 §3D — completing the
 * underlying condition stops all reminders and moves the item to history.
 */
export async function completeActionsFor(
  db: Db,
  actionType: string,
  entityId: string,
  recipientId?: string,
): Promise<void> {
  try {
    let q = db
      .from<{ id: string; action_meta: Record<string, unknown> | null }>("event_deliveries")
      .select("id, action_meta")
      .eq("action_required", true)
      .eq("action_status", "open")
      .eq("action_type", actionType);
    if (recipientId) q = q.eq("recipient_account_id", recipientId);
    const { data } = await q;
    const ids = (data ?? [])
      .filter((r) => (r.action_meta as { entity_id?: string } | null)?.entity_id === entityId)
      .map((r) => r.id);
    if (ids.length === 0) return;
    await db
      .from<Row>("event_deliveries")
      .update({ action_status: "resolved", action_completed_at: new Date().toISOString() })
      .in("id", ids);
  } catch (e) {
    console.warn(
      `[action-required] complete ${actionType}/${entityId} failed:`,
      e instanceof Error ? e.message : e,
    );
  }
}

// ---------------------------------------------------------------------------
// Daily reminder sweep (#561 §3B) — scheduled, never lazy
// ---------------------------------------------------------------------------

/**
 * Send due follow-up reminders for open actions. Email only (the in-app item
 * is already pinned and highlighted); each reminder respects the recipient's
 * preference gate and stops the moment the action is resolved, dismissed or
 * expired. Max sends per urgency: High 3, Medium 3, Low 2 (initial included).
 */
export async function runActionReminderSweep(db: Db, now: Date = new Date()): Promise<void> {
  const { data: due } = await db
    .from<{
      id: string;
      recipient_account_id: string;
      action_urgency: string | null;
      action_reminder_count: number;
      action_next_reminder_at: string | null;
      action_expires_at: string | null;
      case_events: { event_type: string; payload: Record<string, unknown> } | null;
    }>("event_deliveries")
    .select(
      "id, recipient_account_id, action_urgency, action_reminder_count, action_next_reminder_at, action_expires_at, case_events(event_type, payload)",
    )
    .eq("action_required", true)
    .eq("action_status", "open")
    .eq("channel", "in_app")
    .limit(200);

  for (const row of due ?? []) {
    if (!shouldSendReminder(row, now)) continue;
    const eventType = row.case_events?.event_type ?? "";
    const payload = row.case_events?.payload ?? {};
    const count = row.action_reminder_count;
    const urgency = row.action_urgency as ActionUrgency;
    const next = reminderAt(urgency, count + 1, now);

    // Reminder email, preference-gated (in-app stays put either way).
    try {
      const profile = (
        await db
          .from<{
            email: string | null;
            locale: string | null;
            notification_preferences: unknown;
          }>("profiles")
          .select("email, locale, notification_preferences")
          .eq("id", row.recipient_account_id)
          .maybeSingle()
      ).data;
      const email = profile?.email;
      const prefs = (profile?.notification_preferences ?? {}) as Record<string, unknown>;
      const key = prefsKeyForEmail(eventType, payload, row.recipient_account_id);
      if (email && prefs[key] !== false) {
        const { sendActionRequiredEmail } = await import("@/features/cases/action-email.server");
        await sendActionRequiredEmail(
          db,
          email,
          eventType,
          payload,
          `bus:${row.id}:r${count + 1}`,
          profile?.locale ?? "en",
          { reminder: true },
        );
      }
    } catch (e) {
      console.warn(
        `[action-required] reminder email for ${row.id} failed:`,
        e instanceof Error ? e.message : e,
      );
    }

    await db
      .from<Row>("event_deliveries")
      .update({
        action_reminder_count: count + 1,
        action_next_reminder_at: next ? next.toISOString() : null,
      })
      .eq("id", row.id);
  }
}

// ---------------------------------------------------------------------------
// AR-4 / AR-10 daily scans: missing critical fields
// ---------------------------------------------------------------------------

/**
 * An open action for (type, recipient, entity) already exists? Scans re-run
 * on every drain, so they must not pile up duplicate events — uq_ar_open
 * would reject the delivery anyway, but skipping the insert keeps
 * case_events clean.
 */
async function hasOpenAction(
  db: Db,
  actionType: string,
  recipientId: string,
  entityId: string,
): Promise<boolean> {
  const { data } = await db
    .from<{ id: string; action_meta: Record<string, unknown> | null }>("event_deliveries")
    .select("id, action_meta")
    .eq("action_required", true)
    .eq("action_status", "open")
    .eq("action_type", actionType)
    .eq("recipient_account_id", recipientId)
    .limit(50);
  return (data ?? []).some(
    (r) => (r.action_meta as { entity_id?: string } | null)?.entity_id === entityId,
  );
}

/**
 * Detect missing critical info (#561 AR-4 / AR-10) and open or resolve the
 * matching actions. Runs inside the drain (lazy, idempotent via uq_ar_open):
 *
 *   AR-4  — published tutors missing subjects / rate / headline → medium.
 *   AR-10 — tutors still unpublished 30+ days after signup → low.
 */
export async function scanProfileGaps(db: Db, now: Date = new Date()): Promise<void> {
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400_000).toISOString();

  const { data: tutors } = await db
    .from<{
      user_id: string | null;
      subjects: string[] | null;
      hourly_rate: number | null;
      min_hourly_rate_hkd: number | null;
      headline: string | null;
      is_published: boolean | null;
      created_at: string;
    }>("tutors")
    .select(
      "user_id, subjects, hourly_rate, min_hourly_rate_hkd, headline, is_published, created_at",
    )
    .limit(500);

  for (const t of tutors ?? []) {
    if (!t.user_id) continue;
    const userId = t.user_id;
    const missingFields: string[] = [];
    if (!t.subjects || t.subjects.length === 0) missingFields.push("subjects");
    if (!(t.hourly_rate ?? t.min_hourly_rate_hkd)) missingFields.push("rate");
    if (!t.headline) missingFields.push("headline");

    if (t.is_published && missingFields.length > 0) {
      if (!(await hasOpenAction(db, "profile_fields", userId, userId))) {
        await emitDirectAction(db, "action.profile_fields", userId, {
          context: "teaching",
          entity_id: userId,
          missing: missingFields,
          link: "/dashboard#my-tutor",
        });
      }
    } else {
      await completeActionsFor(db, "profile_fields", userId);
    }

    if (!t.is_published && t.created_at <= thirtyDaysAgo && missingFields.length > 0) {
      if (!(await hasOpenAction(db, "onboarding", userId, userId))) {
        await emitDirectAction(db, "action.onboarding", userId, {
          context: "teaching",
          entity_id: userId,
          missing: missingFields,
          link: "/dashboard#my-tutor",
        });
      }
    } else if (t.is_published) {
      await completeActionsFor(db, "onboarding", userId);
    }
  }
}

// ---------------------------------------------------------------------------
// User surface: dismiss / mark complete
// ---------------------------------------------------------------------------

/** Low-urgency items can be dismissed by their owner ("Not now"). */
export const dismissMyAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ deliveryId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const owned = await db
      .from<{ id: string }>("event_deliveries")
      .select("id")
      .eq("id", data.deliveryId)
      .eq("recipient_account_id", context.userId)
      .eq("action_required", true)
      .eq("action_status", "open")
      .eq("action_urgency", "low")
      .limit(1);
    if ((owned.data ?? []).length === 0) return { ok: true }; // not owned / not dismissable
    const { error } = await db
      .from<Row>("event_deliveries")
      .update({
        action_status: "dismissed",
        action_dismissed_by: context.userId,
        action_next_reminder_at: null,
      })
      .eq("id", data.deliveryId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** AR-5 admin-appointed tasks resolve when the user taps "Mark complete". */
export const completeMyAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ deliveryId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { error } = await db
      .from<Row>("event_deliveries")
      .update({ action_status: "resolved", action_completed_at: new Date().toISOString() })
      .eq("id", data.deliveryId)
      .eq("recipient_account_id", context.userId)
      .eq("action_required", true)
      .eq("action_status", "open")
      .eq("action_type", "admin_task");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Admin Appoint Action tool (#561 §3E admin surface)
// ---------------------------------------------------------------------------

const adminActionInput = z.object({
  userEmail: z.string().trim().toLowerCase().email().optional(),
  userId: z.string().uuid().optional(),
  titleEn: z.string().trim().min(3).max(200),
  titleZh: z.string().trim().max(200).optional(),
  body: z.string().trim().min(3).max(1000),
  urgency: z.enum(["high", "medium", "low"]),
  link: z.string().trim().max(300).optional(),
  ctaLabelEn: z.string().trim().max(60).optional(),
  ctaLabelZh: z.string().trim().max(60).optional(),
  expiresInDays: z.number().int().min(1).max(90).optional(),
});

export type AdminActionResult = { ok: boolean; deliveryIds: number; error?: string };

async function profileIdByEmail(client: AdminQueryClient, email: string): Promise<string | null> {
  const { data } = await client
    .from("profiles")
    .select("id, email")
    .ilike("email", email)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export const createAdminAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => adminActionInput.parse(input))
  .handler(async ({ context, data }): Promise<AdminActionResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertStaff(context.supabase, context.userId);
    const client = supabaseAdmin as unknown as AdminQueryClient;

    let recipient = data.userId ?? null;
    if (!recipient && data.userEmail) recipient = await profileIdByEmail(client, data.userEmail);
    if (!recipient) return { ok: false, deliveryIds: 0, error: "Recipient not found." };

    const expiresAt = data.expiresInDays
      ? new Date(Date.now() + data.expiresInDays * 86400_000).toISOString()
      : null;
    const entityId = crypto.randomUUID();

    const db = asAdminDb(supabaseAdmin);
    await emitActionEvent(
      db,
      "action.admin_task",
      {
        recipient_account_id: recipient,
        context: "system",
        entity_id: entityId,
        admin_title: data.titleEn,
        admin_title_zh: data.titleZh ?? data.titleEn,
        admin_body: data.body,
        cta_label: data.ctaLabelEn ?? null,
        cta_label_zh: data.ctaLabelZh ?? data.ctaLabelEn ?? null,
        urgency: data.urgency,
        link: data.link ?? null,
        expires_at: expiresAt,
      },
      entityId,
    );
    return { ok: true, deliveryIds: 1 };
  });

export type AdminActionRow = {
  id: string;
  created_at: string;
  event_type: string;
  admin_title: string | null;
  action_type: string;
  urgency: string;
  status: string;
  reminder_count: number;
};

export const listAdminOpenActions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ userEmail: z.string().trim().toLowerCase() }).parse(input),
  )
  .handler(
    async ({ context, data }): Promise<{ profileFound: boolean; actions: AdminActionRow[] }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await assertStaff(context.supabase, context.userId);
      const db = asAdminDb(supabaseAdmin);
      const client = supabaseAdmin as unknown as AdminQueryClient;

      const recipient = await profileIdByEmail(client, data.userEmail);
      if (!recipient) return { profileFound: false, actions: [] };

      const { data: rows } = await db
        .from<{
          id: string;
          created_at: string;
          action_type: string | null;
          action_urgency: string | null;
          action_status: string | null;
          action_reminder_count: number;
          case_events: { event_type: string; payload: Record<string, unknown> } | null;
        }>("event_deliveries")
        .select(
          "id, created_at, action_type, action_urgency, action_status, action_reminder_count, case_events(event_type, payload)",
        )
        .eq("recipient_account_id", recipient)
        .eq("action_required", true)
        .order("created_at", { ascending: false })
        .limit(50);
      return {
        profileFound: true,
        actions: (rows ?? []).map((r) => ({
          id: r.id,
          created_at: r.created_at,
          event_type: r.case_events?.event_type ?? "unknown",
          admin_title:
            ((r.case_events?.payload as Record<string, unknown> | undefined)?.admin_title as
              string | null) ?? null,
          action_type: r.action_type ?? "",
          urgency: r.action_urgency ?? "",
          status: r.action_status ?? "",
          reminder_count: r.action_reminder_count,
        })),
      };
    },
  );

export const dismissAdminAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ deliveryId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertStaff(context.supabase, context.userId);
    const db = asAdminDb(supabaseAdmin);
    const { error } = await db
      .from<Row>("event_deliveries")
      .update({
        action_status: "dismissed",
        action_dismissed_by: context.userId,
        action_next_reminder_at: null,
      })
      .eq("id", data.deliveryId)
      .eq("action_required", true)
      .eq("action_status", "open");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Used by the admin editor's urgency select (kept in one place). */
export const ACTION_URGENCIES: readonly ActionUrgency[] = ["high", "medium", "low"];
