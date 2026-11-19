/**
 * #782 §2.4 (was #755): Urgent Safety auto-quarantine + staff Emergency
 * Suspend. Quarantine reuses tutors.card_hidden_by_ban as the card lock (the
 * owner cannot republish while it is set); listings go to status 'hidden'.
 * Every action writes a safety_quarantines row; staff release it.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db, type Row } from "@/features/cases/desk-db";
import {
  PROFILE_TARGET_TYPES,
  URGENT_SAFETY_REASON,
  quarantineDecision,
  type QuarantineTrigger,
} from "@/features/trust/quarantine";

async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return asAdminDb(supabaseAdmin);
}

/** staff / admin / super_admin (suspend is a staff action, #308). */
async function requireStaff(db: Db, userId: string): Promise<void> {
  for (const role of ["staff", "admin", "super_admin"] as const) {
    const { data } = await db.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return;
  }
  throw new Error("FORBIDDEN");
}

/** Is the reporter a party on a real case with this tutor / a buyer of this seller? */
async function isVerifiedMatched(db: Db, reporterId: string, tutorId: string): Promise<boolean> {
  const [cases, trials, orders] = await Promise.all([
    selectRows<{ id: string }>(db, "tutoring_cases", "id", [
      { col: "parent_id", op: "eq", value: reporterId },
      { col: "matched_tutor_id", op: "eq", value: tutorId },
    ]),
    selectRows<{ id: string }>(db, "case_trial_intros", "id", [
      { col: "parent_id", op: "eq", value: reporterId },
      { col: "tutor_id", op: "eq", value: tutorId },
    ]),
    selectRows<{ id: string; paid_at: string | null }>(db, "material_orders", "id, paid_at", [
      { col: "buyer_account_id", op: "eq", value: reporterId },
      { col: "tutor_id", op: "eq", value: tutorId },
    ]),
  ]);
  return cases.length > 0 || trials.length > 0 || orders.some((o) => o.paid_at !== null);
}

async function hasOpenQuarantine(
  db: Db,
  match: { col: "tutor_id" | "material_id"; value: string },
): Promise<boolean> {
  const rows = await selectRows<{ released_at: string | null }>(
    db,
    "safety_quarantines",
    "released_at",
    [{ col: match.col, op: "eq", value: match.value }],
  );
  return rows.some((r) => r.released_at === null);
}

async function quarantineProfile(
  db: Db,
  tutorId: string,
  trigger: QuarantineTrigger,
  reportId: string | null,
): Promise<void> {
  if (await hasOpenQuarantine(db, { col: "tutor_id", value: tutorId })) return;
  const tutors = await selectRows<{ is_published: boolean | null; user_id: string | null }>(
    db,
    "tutors",
    "is_published, user_id",
    [{ col: "id", op: "eq", value: tutorId }],
  );
  const wasPublished = tutors[0]?.is_published === true;
  const { error } = await db
    .from<Row>("tutors")
    .update({ is_published: false, card_hidden_by_ban: true })
    .eq("id", tutorId);
  if (error) throw new Error(error.message);
  await db.from<Row>("safety_quarantines").insert({
    trigger_kind: trigger,
    tutor_id: tutorId,
    account_id: tutors[0]?.user_id ?? null,
    report_id: reportId,
    card_was_published: wasPublished,
  });
}

async function quarantineListing(
  db: Db,
  materialId: string,
  tutorId: string | null,
  trigger: QuarantineTrigger,
  reportId: string | null,
): Promise<void> {
  if (await hasOpenQuarantine(db, { col: "material_id", value: materialId })) return;
  const { count, error } = await db
    .from<Row>("digital_materials")
    .update({ status: "hidden" }, { count: "exact" })
    .eq("id", materialId)
    .eq("status", "published");
  if (error) throw new Error(error.message);
  await db.from<Row>("safety_quarantines").insert({
    trigger_kind: trigger,
    material_id: materialId,
    tutor_id: tutorId,
    report_id: reportId,
    hidden_material_ids: (count ?? 0) > 0 ? [materialId] : [],
  });
}

/**
 * Called right after an urgent_safety report is inserted. Never throws: the
 * report itself is already filed and reaches the staff queue regardless.
 */
export async function applyUrgentSafetyRules(input: {
  reporterId: string;
  targetType: string;
  targetId: string;
  tutorId: string | null;
}): Promise<void> {
  try {
    const db = await adminDb();
    if (!input.tutorId) return;
    const isListing = input.targetType === "material";
    const isProfile = (PROFILE_TARGET_TYPES as readonly string[]).includes(input.targetType);
    if (!isListing && !isProfile) return;

    const reports = await selectRows<{
      id: string;
      reporter_id: string;
      target_type: string;
      target_id: string;
    }>(db, "reports", "id, reporter_id, target_type, target_id", [
      { col: "tutor_id", op: "eq", value: input.tutorId },
      { col: "reason", op: "eq", value: URGENT_SAFETY_REASON },
      { col: "status", op: "eq", value: "open" },
    ]);
    const sameTarget = reports.filter((r) =>
      isListing
        ? r.target_type === "material" && r.target_id === input.targetId
        : (PROFILE_TARGET_TYPES as readonly string[]).includes(r.target_type),
    );
    const current = sameTarget.find((r) => r.reporter_id === input.reporterId) ?? null;

    const trigger = quarantineDecision({
      reporterVerifiedMatched: await isVerifiedMatched(db, input.reporterId, input.tutorId),
      distinctUnmatchedReporters: new Set(sameTarget.map((r) => r.reporter_id)).size,
    });
    if (!trigger) return;

    if (isListing) {
      await quarantineListing(db, input.targetId, input.tutorId, trigger, current?.id ?? null);
    } else {
      await quarantineProfile(db, input.tutorId, trigger, current?.id ?? null);
    }
    try {
      const { notifyOps } = await import("@/lib/ops-webhook.server");
      void notifyOps("safety.auto_quarantine", {
        tutor_id: input.tutorId,
        target_type: input.targetType,
        trigger,
      }).catch(() => {});
    } catch {
      // ops ping is advisory
    }
  } catch (e) {
    console.error("[quarantine] urgent safety rules failed:", e instanceof Error ? e.message : e);
  }
}

export type QuarantineRow = {
  id: string;
  trigger_kind: string;
  tutor_id: string | null;
  material_id: string | null;
  account_id: string | null;
  note: string | null;
  created_at: string;
  released_at: string | null;
  tutors: { tutor_code: string | null; display_name: string | null } | null;
};

export const listSafetyQuarantines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QuarantineRow[]> => {
    const db = await adminDb();
    await requireStaff(db, context.userId);
    const { data, error } = await db
      .from<QuarantineRow>("safety_quarantines")
      .select(
        "id, trigger_kind, tutor_id, material_id, account_id, note, created_at, released_at, tutors(tutor_code, display_name)",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as QuarantineRow[];
  });

/**
 * Staff 1-click Freeze & Suspend (Emergency Suspend): suspends the account
 * (requireAccountActive then blocks new accepts / uploads), unpublishes the
 * card(s) behind the ban lock and hides every published listing. Audited.
 */
export const emergencySuspendAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        accountId: z.string().uuid().optional(),
        tutorId: z.string().uuid().optional(),
        note: z.string().trim().min(3).max(500),
        reportId: z.string().uuid().optional().nullable(),
      })
      .refine((d) => Boolean(d.accountId || d.tutorId), { message: "accountId or tutorId" })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    await requireStaff(db, context.userId);
    let accountId = data.accountId ?? null;
    if (!accountId && data.tutorId) {
      const owner = await selectRows<{ user_id: string | null }>(db, "tutors", "user_id", [
        { col: "id", op: "eq", value: data.tutorId },
      ]);
      accountId = owner[0]?.user_id ?? null;
    }
    if (!accountId) throw new Error("This tutor card has no linked account to suspend.");
    if (accountId === context.userId) throw new Error("You cannot suspend your own account.");

    const now = new Date().toISOString();
    const { error: statusError } = await db
      .from<Row>("profiles")
      .update({
        account_status: "suspended",
        account_status_reason: `Emergency safety suspend: ${data.note}`,
        account_status_at: now,
      })
      .eq("id", accountId);
    if (statusError) throw new Error(statusError.message);

    const tutors = await selectRows<{ id: string; is_published: boolean | null }>(
      db,
      "tutors",
      "id, is_published",
      [{ col: "user_id", op: "eq", value: accountId }],
    );
    const tutorIds = tutors.map((t) => t.id);
    let hiddenMaterialIds: string[] = [];
    if (tutorIds.length > 0) {
      const { error } = await db
        .from<Row>("tutors")
        .update({ is_published: false, card_hidden_by_ban: true })
        .in("id", tutorIds);
      if (error) throw new Error(error.message);
      const live = await selectRows<{ id: string }>(db, "digital_materials", "id", [
        { col: "tutor_id", op: "in", value: tutorIds },
        { col: "status", op: "eq", value: "published" },
      ]);
      hiddenMaterialIds = live.map((m) => m.id);
      if (hiddenMaterialIds.length > 0) {
        const { error: hideError } = await db
          .from<Row>("digital_materials")
          .update({ status: "hidden" })
          .in("id", hiddenMaterialIds);
        if (hideError) throw new Error(hideError.message);
      }
    }

    const { error: auditError } = await db.from<Row>("safety_quarantines").insert({
      trigger_kind: "emergency_suspend",
      tutor_id: tutorIds[0] ?? null,
      account_id: accountId,
      report_id: data.reportId ?? null,
      hidden_material_ids: hiddenMaterialIds,
      card_was_published: tutors.some((t) => t.is_published === true),
      note: data.note,
      created_by: context.userId,
    });
    if (auditError) throw new Error(auditError.message);
    return { ok: true, hiddenListings: hiddenMaterialIds.length };
  });

/** Staff release after review: undo exactly what the quarantine / suspend did. */
export const releaseSafetyQuarantine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ quarantineId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    await requireStaff(db, context.userId);
    const rows = await selectRows<{
      id: string;
      trigger_kind: string;
      tutor_id: string | null;
      material_id: string | null;
      account_id: string | null;
      hidden_material_ids: string[] | null;
      card_was_published: boolean;
      released_at: string | null;
    }>(
      db,
      "safety_quarantines",
      "id, trigger_kind, tutor_id, material_id, account_id, hidden_material_ids, card_was_published, released_at",
      [{ col: "id", op: "eq", value: data.quarantineId }],
    );
    const q = rows[0];
    if (!q) throw new Error("NOT_FOUND");
    if (q.released_at) return { ok: true };

    if (q.trigger_kind === "emergency_suspend" && q.account_id) {
      await db
        .from<Row>("profiles")
        .update({
          account_status: "active",
          account_status_reason: null,
          account_status_at: new Date().toISOString(),
        })
        .eq("id", q.account_id);
      await db
        .from<Row>("tutors")
        .update({
          card_hidden_by_ban: false,
          ...(q.card_was_published ? { is_published: true } : {}),
        })
        .eq("user_id", q.account_id);
    } else if (q.material_id === null && q.tutor_id) {
      await db
        .from<Row>("tutors")
        .update({
          card_hidden_by_ban: false,
          ...(q.card_was_published ? { is_published: true } : {}),
        })
        .eq("id", q.tutor_id);
    }
    const toRestore = q.hidden_material_ids ?? [];
    if (toRestore.length > 0) {
      await db
        .from<Row>("digital_materials")
        .update({ status: "published" })
        .in("id", toRestore)
        .eq("status", "hidden");
    }
    const { error } = await db
      .from<Row>("safety_quarantines")
      .update({ released_at: new Date().toISOString(), released_by: context.userId })
      .eq("id", q.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
