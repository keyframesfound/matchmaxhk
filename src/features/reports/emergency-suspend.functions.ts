/**
 * #782 §2.4: staff-only Emergency Suspend + quarantine control (admin fns).
 *
 *  - suspendTutorAccount: one-click kill-switch. Stamps tutors.suspended_at,
 *    unpublishes the tutor's public profile (is_published=false) and hides
 *    every published listing, stores the restore data in the audit row, and
 *    blocks new accepts/uploads/publishes through assertNotSuspended in the
 *    four tutor-side server fns (applications, materials, note-drafts,
 *    gig-drafts). The staff note lives in the audit row.
 *  - liftSuspension: reverses exactly what the suspend did (previous
 *    is_published state, only the listings hidden by the suspend).
 *  - liftQuarantine: clears the auto-quarantine stamp after staff review.
 *  - listEmergencyActionsAdmin: the trust-safety desk card data.
 *
 * Every action writes an audit row to trust_suspensions (RLS on, no
 * policies; service role only, admin-gated below). The reported party never
 * learns who filed a report; these fns never carry reporter identity.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminClient } from "@/features/reports/reports.functions";

type SuspendAuditMetadata = {
  prev_is_published?: boolean;
  hidden_listing_ids?: string[];
  target_type?: string;
  target_id?: string;
  basis?: string;
};

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { asAdminDb } = await import("@/features/materials/storage-helpers");
  return asAdminDb(supabaseAdmin);
}

async function actorEmail(userId: string): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as {
      auth: {
        admin: {
          getUserById: (
            id: string,
          ) => Promise<{ data?: { user?: { email?: string | null } } | null }>;
        };
      };
    };
    const { data } = await admin.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

export const suspendTutorAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tutorId: z.string().uuid(),
        note: z.string().trim().min(1).max(1000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdminClient(context);
    const db = await adminDb();

    const tutors = await db
      .from<{
        id: string;
        user_id: string | null;
        is_published: boolean;
        suspended_at: string | null;
      }>("tutors")
      .select("id, user_id, is_published, suspended_at")
      .eq("id", data.tutorId)
      .limit(1);
    const tutor = (tutors.data ?? [])[0];
    if (!tutor) throw new Error("Tutor not found");
    if (tutor.suspended_at) throw new Error("ALREADY_SUSPENDED");

    // Listings hidden by the suspend (restore list), then hide them.
    const published = await db
      .from<{ id: string }>("digital_materials")
      .select("id")
      .eq("tutor_id", tutor.id)
      .eq("status", "published");
    const hiddenListingIds = (published.data ?? []).map((row) => row.id);
    if (hiddenListingIds.length > 0) {
      const res = await db
        .from<never>("digital_materials")
        .update({ status: "hidden" })
        .eq("tutor_id", tutor.id)
        .eq("status", "published");
      if (res.error) throw new Error(res.error.message || "Failed to hide listings");
    }

    const res = await db
      .from<never>("tutors")
      .update({ suspended_at: new Date().toISOString(), is_published: false })
      .eq("id", tutor.id);
    if (res.error) throw new Error(res.error.message || "Failed to suspend");

    const audit = await db.from<never>("trust_suspensions").insert({
      action: "suspend",
      tutor_id: tutor.id,
      target_user_id: tutor.user_id,
      actor_id: context.userId,
      actor_email: await actorEmail(context.userId),
      note: data.note,
      metadata: {
        prev_is_published: tutor.is_published,
        hidden_listing_ids: hiddenListingIds,
      },
    });
    if (audit.error) console.warn("[emergency-suspend] audit insert failed:", audit.error);

    return { ok: true, hiddenListings: hiddenListingIds.length };
  });

export const liftSuspension = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tutorId: z.string().uuid(),
        note: z.string().trim().max(1000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdminClient(context);
    const db = await adminDb();

    const tutors = await db
      .from<{ id: string; suspended_at: string | null }>("tutors")
      .select("id, suspended_at")
      .eq("id", data.tutorId)
      .limit(1);
    const tutor = (tutors.data ?? [])[0];
    if (!tutor) throw new Error("Tutor not found");
    if (!tutor.suspended_at) throw new Error("NOT_SUSPENDED");

    // Restore exactly what the suspend did, from the latest suspend audit row.
    const audits = await db
      .from<{ metadata: SuspendAuditMetadata | null }>("trust_suspensions")
      .select("metadata")
      .eq("tutor_id", tutor.id)
      .eq("action", "suspend")
      .order("created_at", { ascending: false })
      .limit(1);
    const meta = (audits.data ?? [])[0]?.metadata ?? {};

    const listingIds = Array.isArray(meta.hidden_listing_ids)
      ? meta.hidden_listing_ids.filter((id): id is string => typeof id === "string")
      : [];
    if (listingIds.length > 0) {
      const res = await db
        .from<never>("digital_materials")
        .update({ status: "published" })
        .in("id", listingIds)
        .eq("status", "hidden");
      if (res.error) throw new Error(res.error.message || "Failed to restore listings");
    }

    const res = await db
      .from<never>("tutors")
      .update({ suspended_at: null, is_published: meta.prev_is_published ?? true })
      .eq("id", tutor.id);
    if (res.error) throw new Error(res.error.message || "Failed to lift suspension");

    await db.from<never>("trust_suspensions").insert({
      action: "lift",
      tutor_id: tutor.id,
      target_user_id: null,
      actor_id: context.userId,
      actor_email: await actorEmail(context.userId),
      note: data.note?.trim() ? data.note.trim() : null,
      metadata: { target_type: "tutor", target_id: tutor.id },
    });
    return { ok: true };
  });

export const liftQuarantine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        targetType: z.enum(["tutor", "material"]),
        targetId: z.string().uuid(),
        note: z.string().trim().max(1000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdminClient(context);
    const db = await adminDb();

    if (data.targetType === "material") {
      const res = await db
        .from<never>("digital_materials")
        .update({ quarantined_at: null })
        .eq("id", data.targetId);
      if (res.error) throw new Error(res.error.message || "Failed to remove quarantine");
    } else {
      const res = await db
        .from<never>("tutors")
        .update({ quarantined_at: null })
        .eq("id", data.targetId);
      if (res.error) throw new Error(res.error.message || "Failed to remove quarantine");
    }

    await db.from<never>("trust_suspensions").insert({
      action: "unquarantine",
      tutor_id: data.targetType === "tutor" ? data.targetId : null,
      target_user_id: null,
      actor_id: context.userId,
      actor_email: await actorEmail(context.userId),
      note: data.note?.trim() ? data.note.trim() : null,
      metadata: { target_type: data.targetType, target_id: data.targetId },
    });
    return { ok: true };
  });

export type EmergencyActionRow = {
  tutor_id: string;
  tutor_code: string | null;
  display_name: string;
  user_id: string | null;
  suspended_at: string | null;
  quarantined_at: string | null;
  last_note: string | null;
  last_action_at: string | null;
};

/** Active suspensions + quarantines for the trust-safety desk card. */
export const listEmergencyActionsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EmergencyActionRow[]> => {
    await assertAdminClient(context);
    const db = await adminDb();

    const tutors = await db
      .from<{
        id: string;
        tutor_code: string | null;
        display_name: string;
        user_id: string | null;
        suspended_at: string | null;
        quarantined_at: string | null;
      }>("tutors")
      .select("id, tutor_code, display_name, user_id, suspended_at, quarantined_at")
      .or("suspended_at.not.is.null,quarantined_at.not.is.null")
      .order("suspended_at", { ascending: false, nullsLast: true })
      .limit(50);

    const rows = (tutors.data ?? []).map((tutor) => ({
      tutor_id: tutor.id,
      tutor_code: tutor.tutor_code,
      display_name: tutor.display_name,
      user_id: tutor.user_id,
      suspended_at: tutor.suspended_at,
      quarantined_at: tutor.quarantined_at,
      last_note: null as string | null,
      last_action_at: null as string | null,
    }));
    if (rows.length === 0) return [];

    // Latest audit note per tutor (staff context for the desk).
    const audits = await db
      .from<{ tutor_id: string | null; note: string | null; created_at: string }>(
        "trust_suspensions",
      )
      .select("tutor_id, note, created_at")
      .in(
        "tutor_id",
        rows.map((row) => row.tutor_id),
      )
      .order("created_at", { ascending: false })
      .limit(200);
    const seen = new Set<string>();
    for (const audit of audits.data ?? []) {
      if (!audit.tutor_id || seen.has(audit.tutor_id)) continue;
      seen.add(audit.tutor_id);
      const row = rows.find((r) => r.tutor_id === audit.tutor_id);
      if (row) {
        row.last_note = audit.note;
        row.last_action_at = audit.created_at;
      }
    }
    return rows;
  });
