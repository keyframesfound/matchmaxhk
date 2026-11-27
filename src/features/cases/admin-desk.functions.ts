/**
 * Issue #201, admin case-desk server fns: SoR transitions + audit, intro
 * lessons 1–2, admin-fee lifecycle, unpaid queue, case creation.
 *
 * Admin-gated via has_role (mirror of the orders-desk pattern). All SoR
 * tables are RLS-deny; writes run on the service-role client. Illegal status
 * jumps fail before any write (assertTransition) and again in the DB trigger.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { resolveTutorTimezone } from "@/features/cases/tutor-timezone";
import type { CaseLessonRow, FeeStatus, SorCaseRow, SorStatus } from "@/features/cases/sor-db";
import {
  ALLOWED_TRANSITIONS,
  assertTransition,
  computeFeeAmountHkd,
  feeDueAtFrom,
  hktFromParts,
  isLegalTransition,
} from "@/features/cases/sor";
import { buildCaseFlagRow, type CaseFlagReason } from "@/features/cases/case-flags";
import { requireAdmin, requireDeskStaff } from "@/features/cases/desk-db";
import { syncCaseFeeMilestones } from "@/features/cases/fee-milestones.server";
import { assertAdminFeeNotWaived } from "@/features/cases/fee-waiver.server";
import { shortCaseOverrunError } from "@/features/cases/short-case";

type Row = Record<string, unknown>;
type Db = ReturnType<typeof asAdminDb>;
type DbError = { message: string } | null;

async function selectRows<T extends Row>(
  db: Db,
  table: string,
  cols: string,
  match: { col: string; op: "eq" | "in" | "neq"; value: unknown }[],
  order?: { col: string; asc?: boolean; limit?: number },
): Promise<T[]> {
  let q = db.from<T>(table).select(cols);
  for (const m of match) {
    if (m.op === "eq") q = q.eq(m.col, m.value);
    else if (m.op === "neq") q = q.neq(m.col, m.value);
    else q = q.in(m.col, m.value as unknown[]);
  }
  if (order) q = q.order(order.col, { ascending: order.asc ?? true });
  if (order?.limit) q = q.limit(order.limit);
  const { data } = await q;
  return (data ?? []) as T[];
}

async function insertAudit(
  db: Db,
  caseId: string,
  actorId: string | null,
  fromStatus: string | null,
  toStatus: string,
  reason: string | null,
): Promise<void> {
  const { error } = await db
    .from<Row>("case_audit")
    .insert({
      case_id: caseId,
      actor_id: actorId,
      from_status: fromStatus,
      to_status: toStatus,
      reason,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Desk list + case detail
// ---------------------------------------------------------------------------

export type DeskCaseRow = {
  id: string;
  case_code: string;
  title: string;
  sor_status: SorStatus | null;
  hourly_rate_hkd: number | null;
  fee_status: FeeStatus | null;
  fee_amount_hkd: number | null;
  next_lesson_at: string | null;
  matched_tutor_id: string | null;
  tutor_name: string | null;
  tutor_code: string | null;
};

export const listDeskCases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DeskCaseRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireDeskStaff(db, context.userId);

    const cases = await selectRows<
      SorCaseRow & { tutors: { display_name: string; tutor_code: string | null } | null }
    >(
      db,
      "tutoring_cases",
      "id, case_code, title, sor_status, hourly_rate_hkd, matched_tutor_id, tutors(display_name, tutor_code)",
      [{ col: "sor_status", op: "neq", value: null }],
      { col: "created_at", asc: false, limit: 200 },
    );
    if (cases.length === 0) return [];

    const [fees, lessons] = await Promise.all([
      selectRows<{ case_id: string; status: FeeStatus; amount_hkd: number }>(
        db,
        "case_fees",
        "case_id, status, amount_hkd",
        [{ col: "case_id", op: "in", value: cases.map((c) => c.id) }],
      ),
      selectRows<{ case_id: string; starts_at: string }>(
        db,
        "case_lessons",
        "case_id, starts_at",
        [{ col: "case_id", op: "in", value: cases.map((c) => c.id) }],
        { col: "starts_at", asc: true },
      ),
    ]);
    const openFee = new Map<string, { status: FeeStatus; amount: number }>();
    for (const f of fees) {
      if (f.status === "not_due" || f.status === "invoiced" || f.status === "paid") {
        openFee.set(f.case_id, { status: f.status, amount: f.amount_hkd });
      }
    }
    const nextLesson = new Map<string, string>();
    const now = Date.now();
    for (const l of lessons) {
      if (Date.parse(l.starts_at) >= now && !nextLesson.has(l.case_id)) {
        nextLesson.set(l.case_id, l.starts_at);
      }
    }

    return cases.map((c) => ({
      id: c.id,
      case_code: c.case_code,
      title: c.title,
      sor_status: c.sor_status,
      hourly_rate_hkd: c.hourly_rate_hkd,
      fee_status: openFee.get(c.id)?.status ?? null,
      fee_amount_hkd: openFee.get(c.id)?.amount ?? null,
      next_lesson_at: nextLesson.get(c.id) ?? null,
      matched_tutor_id: c.matched_tutor_id,
      tutor_name: c.tutors?.display_name ?? null,
      tutor_code: c.tutors?.tutor_code ?? null,
    }));
  });

export const getDeskCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireDeskStaff(db, context.userId);

    const cases = await selectRows<
      SorCaseRow & {
        tutors: {
          display_name: string;
          tutor_code: string | null;
          timezone?: string | null;
        } | null;
      }
    >(db, "tutoring_cases", "*, tutors(display_name, tutor_code, timezone)", [
      { col: "id", op: "eq", value: data.caseId },
    ]);
    const c = cases[0];
    if (!c) throw new Error("CASE_NOT_FOUND");

    const [lessons, fees, audit] = await Promise.all([
      selectRows<{
        id: string;
        sequence: number;
        starts_at: string;
        duration_min: number;
        status: string;
        location_or_link: string | null;
        confirmed_by_parent_at: string | null;
        confirmed_by_tutor_at: string | null;
      }>(
        db,
        "case_lessons",
        "id, sequence, starts_at, duration_min, status, location_or_link, confirmed_by_parent_at, confirmed_by_tutor_at",
        [{ col: "case_id", op: "eq", value: c.id }],
        { col: "sequence", asc: true },
      ),
      selectRows<{
        id: string;
        status: FeeStatus;
        amount_hkd: number;
        rate_hkd: number;
        multiplier: number;
        due_at: string | null;
        paid_at: string | null;
        fps_reference: string | null;
        waive_reason: string | null;
        payment_screenshot_path: string | null;
      }>(
        db,
        "case_fees",
        "id, status, amount_hkd, rate_hkd, multiplier, due_at, paid_at, fps_reference, waive_reason, payment_screenshot_path",
        [{ col: "case_id", op: "eq", value: c.id }],
        { col: "created_at", asc: false },
      ),
      selectRows<{
        id: string;
        actor_id: string | null;
        from_status: string | null;
        to_status: string;
        reason: string | null;
        created_at: string;
      }>(
        db,
        "case_audit",
        "id, actor_id, from_status, to_status, reason, created_at",
        [{ col: "case_id", op: "eq", value: c.id }],
        { col: "created_at", asc: false, limit: 20 },
      ),
    ]);

    // #816 §2.5: the audit row already carried actor_id and the UI discarded
    // it, so "who closed this / who waived the fee" was unanswerable. Resolve
    // the distinct actors in one lookup; a null actor is the system.
    const actorIds = [...new Set(audit.map((a) => a.actor_id).filter(Boolean))] as string[];
    const actors = actorIds.length
      ? await selectRows<{ id: string; display_name: string | null; email: string | null }>(
          db,
          "profiles",
          "id, display_name, email",
          [{ col: "id", op: "in", value: actorIds }],
        )
      : [];
    const nameById = new Map(
      actors.map(
        (a) => [a.id, a.display_name?.trim() || a.email?.split("@")[0] || "Staff"] as const,
      ),
    );

    return {
      id: c.id,
      case_code: c.case_code,
      title: c.title,
      sor_status: c.sor_status,
      hourly_rate_hkd: c.hourly_rate_hkd,
      student_count: c.student_count,
      exam_system: c.exam_system,
      subjects: c.subjects,
      student_level: c.student_level,
      student_grade_current: c.student_grade_current,
      district: c.district,
      whatsapp_group_url: c.whatsapp_group_url,
      internal_note: c.internal_note,
      contact_name: c.contact_name,
      contact_phone: c.contact_phone,
      tutor_name: c.tutors?.display_name ?? null,
      tutor_code: c.tutors?.tutor_code ?? null,
      // #798: the desk reads lesson times in the matched tutor's zone.
      tutor_timezone: resolveTutorTimezone(c.tutors?.timezone ?? null),
      lessons,
      fees,
      audit: audit.map((a) => ({
        ...a,
        actor_name: a.actor_id ? (nameById.get(a.actor_id) ?? "Staff") : null,
      })),
      matched_tutor_id: c.matched_tutor_id,
      schedule_paused_at: c.schedule_paused_at ?? null,
      allowedTransitions: c.sor_status ? (ALLOWED_TRANSITIONS[c.sor_status] ?? []) : [],
    };
  });

// ---------------------------------------------------------------------------
// Transitions + fees
// ---------------------------------------------------------------------------

/**
 * #636 + #634: pausing needs the desk. Setting it cancels future lessons
 * (trg_release_future_lessons) and refuses new ones until cleared.
 */
export const setCaseSchedulePaused = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ caseId: z.string().uuid(), paused: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ paused: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireDeskStaff(db, context.userId);
    const { error } = await db
      .from<Row>("tutoring_cases")
      .update({ schedule_paused_at: data.paused ? new Date().toISOString() : null })
      .eq("id", data.caseId);
    if (error) throw new Error(error.message);
    await insertAudit(
      db,
      data.caseId,
      context.userId,
      null,
      data.paused ? "schedule_paused" : "schedule_resumed",
      null,
    );
    return { paused: data.paused };
  });

export const transitionCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        to: z.string(),
        reason: z.string().max(500).optional(),
        fpsReference: z.string().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ sor_status: SorStatus }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireDeskStaff(db, context.userId);

    const rows = await selectRows<
      Pick<
        SorCaseRow,
        "id" | "sor_status" | "hourly_rate_hkd" | "student_count" | "is_short_case"
      > & { matched_tutor_id: string | null }
    >(
      db,
      "tutoring_cases",
      "id, sor_status, hourly_rate_hkd, student_count, is_short_case, matched_tutor_id",
      [{ col: "id", op: "eq", value: data.caseId }],
    );
    const c = rows[0];
    if (!c) throw new Error("CASE_NOT_FOUND");
    if (!c.sor_status) throw new Error("NOT_A_SOR_CASE");
    const to = data.to as SorStatus;
    assertTransition(c.sor_status, to); // throws IllegalTransitionError on illegal jumps

    // #443: while short, the ONLY legal platform fee is the 20% package fee
    // from the Short case panel. Letting the standard Lesson-2 trigger fire
    // here billed 1.5× × students on a case that owes 20% of its package.
    if (to === "fee_invoiced" && c.is_short_case) {
      throw new Error("SHORT_CASE_USE_SHORT_FEE");
    }

    const nowIso = new Date().toISOString();

    // #772 Part 1: the SoR transition INTO the trial states is the unlock, so
    // the mutex is enforced here (SoR desk + match panel both land on this fn).
    // A second tutor cannot be introduced while another trial is active on the
    // request, and a 3rd introduction needs ops approval first.
    const { claimTrialIntro, closeTrialIntro, derivedCloseKind } =
      await import("@/features/cases/trial-lock.server");
    if (to === "introduced") {
      if (!c.matched_tutor_id) throw new Error("NO_MATCHED_TUTOR");
      const claim = await claimTrialIntro(db, {
        caseId: c.id,
        tutorId: c.matched_tutor_id,
        source: "in_app",
      });
      if (!claim.ok) throw new Error(claim.reason);
    }

    const { error } = await db
      .from<Row>("tutoring_cases")
      .update({ sor_status: to, sor_status_at: nowIso })
      .eq("id", c.id);
    if (error) throw new Error(error.message);
    await insertAudit(db, c.id, context.userId, c.sor_status, to, data.reason ?? null);

    // #772 Part 1: leaving the trial states spends the introduction, which is
    // what unlocks the next shortlisted tutor (pre-L1 cancel = HK$0 matching
    // fee; stop-after-L1 leaves the #760 fee path untouched).
    const wasActiveTrial =
      c.sor_status === "introduced" ||
      c.sor_status === "lesson_1_scheduled" ||
      c.sor_status === "lesson_1_done";
    if (wasActiveTrial && (to === "closed" || to === "replaced")) {
      const closeKind =
        to === "replaced" ? "replaced" : await derivedCloseKind(db, c.id, c.sor_status);
      try {
        await closeTrialIntro(db, { caseId: c.id, closeKind, actorId: context.userId });
      } catch (closeError) {
        // Never block the SoR close on the ledger: the desk's close is the
        // product action, a stale ledger row is repaired by the next claim.
        console.error("[#772] trial intro close failed:", closeError);
      }
    }

    // Issue #412 F: the engagement summary is created (or version-bumped)
    // when the case reaches the engagement stage. Fail-open, a summary
    // write failure must never block the desk transition; the next ensure
    // (match panel, detail load) repairs it idempotently.
    if (to === "introduced") {
      try {
        const { ensureEngagementSummaryRow } =
          await import("@/features/cases/engagement.functions");
        await ensureEngagementSummaryRow(c.id);
      } catch (summaryError) {
        console.error("[engagement] failed to ensure summary on introduced:", summaryError);
      }
    }

    // Side effects (#201 flow steps 8–9).
    if (to === "fee_invoiced") {
      await assertAdminFeeNotWaived(db, c.id);
      const open = await selectRows<{ id: string }>(db, "case_fees", "id", [
        { col: "case_id", op: "eq", value: c.id },
        { col: "status", op: "in", value: ["not_due", "invoiced", "paid"] },
      ]);
      if (open.length === 0) {
        if (c.hourly_rate_hkd == null) throw new Error("NO_RATE_ON_CASE");
        // #391: group cases pay 1.5 × per-student rate × student_count
        // (rate_hkd stays the per-student quote; the total is scaled here).
        const amount = computeFeeAmountHkd(Number(c.hourly_rate_hkd), 1.5, c.student_count);
        const { error: feeError } = await db
          .from<Row>("case_fees")
          .insert({
            case_id: c.id,
            rate_hkd: c.hourly_rate_hkd,
            multiplier: 1.5,
            amount_hkd: amount,
            status: "invoiced",
            due_at: feeDueAtFrom(new Date()).toISOString(),
          })
          .select("id")
          .single();
        if (feeError) throw new Error(feeError.message);
        await insertAudit(
          db,
          c.id,
          context.userId,
          null,
          "fee_invoiced",
          `1.5 × HK$${c.hourly_rate_hkd} × ${c.student_count} student(s)`,
        );
      }
    }
    if (to === "fee_paid") {
      const invoiced = await selectRows<{ id: string }>(db, "case_fees", "id", [
        { col: "case_id", op: "eq", value: c.id },
        { col: "status", op: "eq", value: "invoiced" },
      ]);
      const markedPaid: string[] = [];
      for (const fee of invoiced) {
        const claimed = await claimFeePaid({
          db,
          feeId: fee.id,
          patch: {
            status: "paid",
            paid_at: nowIso,
            marked_paid_by: context.userId,
            fps_reference: data.fpsReference ?? null,
          },
        });
        if (claimed) markedPaid.push(fee.id);
      }
      // #816 §2.2 residual: this path marked the ledger paid, so it must also
      // write the legacy mirror the referral-bounty trigger reads — otherwise a
      // referrer's 15% is silently never created when the desk closes the fee
      // from the SoR machine instead of Mark paid. Same helper, so the receipt
      // and the mirror fire exactly once per request on either path.
      if (markedPaid.length > 0) {
        await applyPaidFeeSideEffects({ db, caseId: c.id, feeIds: markedPaid, nowIso });
      }
    }
    return { sor_status: to };
  });

export const feeInvoiceCustom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        multiplier: z.number().positive().max(100),
        reason: z.string().min(3).max(500),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireDeskStaff(db, context.userId);

    const rows = await selectRows<
      Pick<SorCaseRow, "id" | "hourly_rate_hkd" | "student_count" | "is_short_case">
    >(db, "tutoring_cases", "id, hourly_rate_hkd, student_count, is_short_case", [
      { col: "id", op: "eq", value: data.caseId },
    ]);
    if (!rows[0]) throw new Error("CASE_NOT_FOUND");
    await assertAdminFeeNotWaived(db, data.caseId);
    if (rows[0].hourly_rate_hkd == null) throw new Error("NO_RATE_ON_CASE");
    // #443: a short case's only legal fee is the 20% package fee from the
    // Short case panel — a custom multiplier here would stack a second rule
    // on top of it.
    if (rows[0].is_short_case) throw new Error("SHORT_CASE_USE_SHORT_FEE");

    // #391: custom multipliers scale per student on group cases too.
    const amount = computeFeeAmountHkd(
      Number(rows[0].hourly_rate_hkd),
      data.multiplier,
      rows[0].student_count,
    );
    const { error } = await db
      .from<Row>("case_fees")
      .insert({
        case_id: data.caseId,
        rate_hkd: rows[0].hourly_rate_hkd,
        multiplier: data.multiplier,
        amount_hkd: amount,
        status: "invoiced",
        due_at: feeDueAtFrom(new Date()).toISOString(),
      })
      .select("id")
      .single();
    // The partial unique index rejects a second open fee, surface it cleanly.
    if (error)
      throw new Error(/duplicate|unique/i.test(error.message) ? "OPEN_FEE_EXISTS" : error.message);
    await insertAudit(
      db,
      data.caseId,
      context.userId,
      null,
      "fee_invoiced",
      `custom ${data.multiplier}×, ${data.reason}`,
    );
    // #428 Phase 1: invoicing milestone.
    try {
      const { logFunnelEvent } = await import("@/features/cases/funnel-events");
      await logFunnelEvent(
        db,
        { case_id: data.caseId, event_type: "fee_invoiced" },
        context.userId,
      );
    } catch (funnelError) {
      console.warn("[admin-desk] funnel log failed:", funnelError);
    }
    return { ok: true };
  });

/**
 * QA (#375): fee desk actions must drive the SoR status machine, not only the
 * fee row. Advances fee_invoiced → fee_paid / waived when the case sits on the
 * SoR machine and the edge is legal; legacy cases (sor_status NULL) and
 * already-advanced cases are left untouched.
 */
async function advanceSorCaseStatus(
  db: ReturnType<typeof asAdminDb>,
  actorId: string,
  caseId: string,
  to: SorStatus,
): Promise<void> {
  const rows = await selectRows<{ sor_status: SorStatus | null }>(
    db,
    "tutoring_cases",
    "sor_status",
    [{ col: "id", op: "eq", value: caseId }],
  );
  const from = rows[0]?.sor_status;
  if (!from || !isLegalTransition(from, to)) return;
  const { error } = await db
    .from<Row>("tutoring_cases")
    .update({ sor_status: to, sor_status_at: new Date().toISOString() })
    .eq("id", caseId);
  if (error) throw new Error(error.message);
  await insertAudit(db, caseId, actorId, from, to, `fee action → ${to}`);
}

/**
 * #816 §2.2 residual: the fee desk wrote "paid" by id alone, so a waived or
 * already-paid fee could be re-marked paid — re-firing the receipt and the
 * referral-bounty mirror on money that was never collected.
 *
 * These predicates are the read half of the guard (they also decide the error
 * code); the write half is a claim on the row itself, filtering on
 * status = "invoiced" with count: "exact", so a concurrent waive cannot slip
 * between the read and the update.
 */

/** Error code that refuses a pay action, or null when the fee may be paid. */
export function feeMarkPaidRefusal(
  fee: { status: string; waive_reason: string | null } | null | undefined,
): string | null {
  if (!fee) return "FEE_NOT_FOUND";
  if (fee.status !== "invoiced" || fee.waive_reason !== null) return "FEE_NOT_INVOICED";
  return null;
}

/** Error code that refuses a waive action, or null when the fee may be waived. */
export function feeWaiveRefusal(fee: { status: string } | null | undefined): string | null {
  if (!fee) return "FEE_NOT_FOUND";
  // Paid and refunded rows already carry money: re-labelling one waived leaves
  // paid_at / marked_paid_by / the collected mirror behind, so derivePaidState
  // reports "none" and the desk can re-invoice what was already collected.
  if (fee.status === "paid" || fee.status === "refunded") return "FEE_ALREADY_PAID";
  if (fee.status !== "invoiced") return "FEE_NOT_INVOICED";
  return null;
}

/**
 * The legacy tutoring_cases.fee_collected_at / fee_amount_cents columns are
 * what trg_cases_fee_referral_bounty reads to create a referrer's 15% bounty
 * (#816 §2.2). Both pay paths use this so they write identical numbers: the
 * summed paid case_fees amount for the case, once. An existing mirror is never
 * moved — the desk must not see its own number rewritten.
 */
export function legacyFeeMirrorPatch(args: {
  existingCollectedAt: string | null;
  paidAmountsHkd: readonly (number | string | null | undefined)[];
  nowIso: string;
}): { fee_collected_at: string; fee_amount_cents: number } | null {
  if (args.existingCollectedAt !== null) return null;
  const total = args.paidAmountsHkd.reduce<number>((sum, amount) => {
    const n = Number(amount);
    return Number.isFinite(n) && n > 0 ? sum + n : sum;
  }, 0);
  if (total <= 0) return null;
  return { fee_collected_at: args.nowIso, fee_amount_cents: Math.round(total * 100) };
}

/**
 * The guarded claim both pay paths use: only an invoiced row flips to paid, and
 * a false result means nothing was written — no receipt, no bounty mirror, no
 * audit row. The #259 FPS trigger code is surfaced as-is.
 */
export async function claimFeePaid(args: { db: Db; feeId: string; patch: Row }): Promise<boolean> {
  const { error, count } = await args.db
    .from<Row>("case_fees")
    .update(args.patch, { count: "exact" })
    .eq("id", args.feeId)
    .eq("status", "invoiced");
  if (error) {
    throw new Error(
      error.message.includes("FPS_REFERENCE_USED") ? "FPS_REFERENCE_USED" : error.message,
    );
  }
  return (count ?? 0) > 0;
}

/**
 * One paid fee, one set of side effects — shared by feeMarkPaid and by
 * transitionCase to fee_paid, so a referrer's bounty never depends on which
 * desk path closed the fee. Callers only reach here after a claim that affected
 * a row, and each request takes one path, so the receipt (once-only via
 * receipt_sent_at) and the mirror (once per case) cannot double-fire.
 */
async function applyPaidFeeSideEffects(args: {
  db: Db;
  caseId: string;
  feeIds: readonly string[];
  nowIso: string;
}): Promise<void> {
  const { sendFeeReceipt } = await import("@/features/cases/fee-desk.functions");
  for (const feeId of args.feeIds) await sendFeeReceipt(args.db, feeId);

  const [paid, legacy] = await Promise.all([
    selectRows<{ amount_hkd: number | null }>(args.db, "case_fees", "amount_hkd", [
      { col: "case_id", op: "eq", value: args.caseId },
      { col: "status", op: "eq", value: "paid" },
    ]),
    selectRows<{ fee_collected_at: string | null }>(args.db, "tutoring_cases", "fee_collected_at", [
      { col: "id", op: "eq", value: args.caseId },
    ]),
  ]);
  const legacyRow = legacy[0];
  if (!legacyRow) return;
  const mirror = legacyFeeMirrorPatch({
    existingCollectedAt: legacyRow.fee_collected_at,
    paidAmountsHkd: paid.map((p) => p.amount_hkd),
    nowIso: args.nowIso,
  });
  if (!mirror) return;
  const { error } = await args.db.from<Row>("tutoring_cases").update(mirror).eq("id", args.caseId);
  // The payment already landed; a failed mirror must not fail the receipt. The
  // desk can still record it from the legacy panel, and the trigger backstops.
  if (error) console.warn("[fee] legacy fee mirror failed:", error.message);
}

export const feeMarkPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ feeId: z.string().uuid(), fpsReference: z.string().max(80).optional() })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireDeskStaff(db, context.userId);
    const fee = (
      await selectRows<{
        case_id: string;
        amount_hkd: number | null;
        status: FeeStatus;
        waive_reason: string | null;
      }>(db, "case_fees", "case_id, amount_hkd, status, waive_reason", [
        { col: "id", op: "eq", value: data.feeId },
      ])
    )[0];
    if (!fee) throw new Error("FEE_NOT_FOUND");
    // #816 §2.2 residual: a waived or already-paid fee must never be re-marked
    // paid — that re-fires the receipt and can create a 15% referral bounty on a
    // fee that was written off, and rewrites paid_at on a paid row.
    const refusal = feeMarkPaidRefusal(fee);
    if (refusal) throw new Error(refusal);

    const { assertReferenceFree } = await import("@/features/cases/fee-desk.functions");
    // #259: a bank reference that already closed another case is rejected
    // (the DB trigger backstops races with the same FPS_REFERENCE_USED code).
    await assertReferenceFree(db, fee.case_id, data.fpsReference);

    const nowIso = new Date().toISOString();
    const claimed = await claimFeePaid({
      db,
      feeId: data.feeId,
      patch: {
        status: "paid",
        paid_at: nowIso,
        marked_paid_by: context.userId,
        fps_reference: data.fpsReference ?? null,
      },
    });
    // A concurrent waive won the claim: nothing was written, so no receipt, no
    // bounty mirror and no audit row may run.
    if (!claimed) throw new Error("FEE_NOT_INVOICED");

    // #816 §2.2 residual: two fee truths. case_fees is the SoR, but the referral
    // bounty trigger keys off the legacy tutoring_cases columns, so every pay
    // path mirrors the collected total once (shared with transitionCase).
    // deskUndoFeeCollected refuses while a paid case_fees row exists, so
    // pay → undo → pay cannot double-credit a referrer or strand a bounty.
    await applyPaidFeeSideEffects({ db, caseId: fee.case_id, feeIds: [data.feeId], nowIso });
    await insertAudit(db, fee.case_id, context.userId, null, "fee_paid", data.fpsReference ?? null);

    // QA (#375): the fee action must also advance the SoR machine, a case stuck
    // on fee_invoiced keeps parent slot requests locked.
    await advanceSorCaseStatus(db, context.userId, fee.case_id, "fee_paid");

    // #542 Trigger 2 / #561 AR-3: contact is now shared — both sides get the
    // introduction notification as an Action Required item until Lesson 1
    // is scheduled/confirmed on the case. Best-effort, never fails the fee.
    try {
      const introCase = (
        await selectRows<{
          id: string;
          case_code: string;
          contact_name: string | null;
          subjects: string[] | null;
          who_for: string | null;
          matched_tutor_id: string | null;
        }>(
          db,
          "tutoring_cases",
          "id, case_code, contact_name, subjects, who_for, matched_tutor_id",
          [{ col: "id", op: "eq", value: fee.case_id }],
        )
      )[0];
      if (introCase) {
        const introTutorId = introCase.matched_tutor_id;
        const tutorRow = introTutorId
          ? (
              await selectRows<{ id: string; display_name: string }>(
                db,
                "tutors",
                "id, display_name",
                [{ col: "id", op: "eq", value: introTutorId }],
              )
            )[0]
          : undefined;
        const isParent = introCase.who_for !== "myself";
        const sharedPayload = {
          case_id: introCase.id,
          case_code: introCase.case_code,
          tutor_id: introTutorId,
          tutor_name: tutorRow?.display_name ?? "",
          contact_name: introCase.contact_name ?? "",
          subject: (introCase.subjects ?? [])[0] ?? "",
          badge: isParent ? "Parent Account" : "Independent Student",
          badge_zh: isParent ? "家長帳戶" : "獨立學生帳戶",
        };
        const { emitActionEvent } = await import("@/features/cases/action-required.functions");
        await emitActionEvent(db, "intro.shared_parent", sharedPayload, introCase.id);
        await emitActionEvent(db, "intro.shared_tutor", sharedPayload, introCase.id);
        // #428 Phase 1: the master reliability gate.
        const { logFunnelEvent } = await import("@/features/cases/funnel-events");
        await logFunnelEvent(
          db,
          {
            case_id: introCase.id,
            tutor_id: introCase.matched_tutor_id,
            event_type: "fee_marked_paid",
          },
          context.userId,
        );
      }
    } catch (introError) {
      console.warn("[admin-desk] intro notification failed:", introError);
    }
    return { ok: true };
  });

export const feeWaive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ feeId: z.string().uuid(), reason: z.string().min(3).max(500) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireDeskStaff(db, context.userId);
    const fee = (
      await selectRows<{ case_id: string; status: FeeStatus }>(db, "case_fees", "case_id, status", [
        { col: "id", op: "eq", value: data.feeId },
      ])
    )[0];
    if (!fee) throw new Error("FEE_NOT_FOUND");
    // A paid or refunded fee keeps paid_at, marked_paid_by and the collected
    // mirror: re-labelling it waived makes derivePaidState report "none" and
    // lets the desk re-invoice money already collected.
    const refusal = feeWaiveRefusal(fee);
    if (refusal) throw new Error(refusal);

    const { error, count } = await db
      .from<Row>("case_fees")
      .update({ status: "waived", waive_reason: data.reason }, { count: "exact" })
      .eq("id", data.feeId)
      .eq("status", "invoiced");
    if (error) throw new Error(error.message);
    // A concurrent pay won the claim: nothing was waived, so no audit row runs.
    if ((count ?? 0) === 0) throw new Error("FEE_NOT_INVOICED");

    await insertAudit(db, fee.case_id, context.userId, null, "fee_waived", data.reason);
    await advanceSorCaseStatus(db, context.userId, fee.case_id, "waived");
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Match + legacy fee capture (#816 §2.5)
//
// These three used to be direct browser updates on tutoring_cases, so the desk
// could not see who un-matched a case or collected/undid the legacy fee. They
// are server fns now purely so each write also lands a case_audit row; the
// columns and the referral-bounty trigger on them are unchanged.
// ---------------------------------------------------------------------------

/**
 * #816 §2.5: removing the matched tutor. The prior tutor is read first so the
 * audit row names who was un-matched; an already-unmatched case still audits
 * (reason null) instead of silently no-op'ing.
 */
export const deskClearMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireDeskStaff(db, context.userId);

    const rows = await selectRows<{
      matched_tutor_id: string | null;
      tutors: { display_name: string; tutor_code: string | null } | null;
    }>(db, "tutoring_cases", "matched_tutor_id, tutors(display_name, tutor_code)", [
      { col: "id", op: "eq", value: data.caseId },
    ]);
    const c = rows[0];
    if (!c) throw new Error("CASE_NOT_FOUND");
    const previous = c.tutors;
    const reason = previous
      ? [previous.display_name, previous.tutor_code].filter(Boolean).join(" · ")
      : null;

    const { error } = await db
      .from<Row>("tutoring_cases")
      .update({ matched_tutor_id: null, matched_at: null })
      .eq("id", data.caseId);
    if (error) throw new Error(error.message);
    await insertAudit(db, data.caseId, context.userId, null, "tutor_removed", reason);
    return { ok: true };
  });

/**
 * #816 §2.5: the legacy "fee collected" columns. Kept as the fee desk's manual
 * offline capture (case_fees is the SoR fee ledger); the trigger on these
 * columns still logs a referred tutor's 15% bounty.
 */
export const deskRecordFeeCollected = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        amountHkd: z.number().finite().positive().max(1_000_000),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireDeskStaff(db, context.userId);

    const amountCents = Math.round(data.amountHkd * 100);
    const { error } = await db
      .from<Row>("tutoring_cases")
      .update({ fee_collected_at: new Date().toISOString(), fee_amount_cents: amountCents })
      .eq("id", data.caseId);
    if (error) throw new Error(error.message);
    await insertAudit(
      db,
      data.caseId,
      context.userId,
      null,
      "fee_collected_legacy",
      `HK$${data.amountHkd} (legacy fee columns)`,
    );
    return { ok: true };
  });

/** #816 §2.5: undo the legacy fee capture. A logged bounty is left in place. */
export const deskUndoFeeCollected = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireDeskStaff(db, context.userId);

    // The desk is the source of truth: once a `case_fees` row is `paid`, the
    // legacy columns below are only a mirror that `feeMarkPaid` writes to fire
    // the bounty trigger. Nulling that mirror from here would delete a bounty
    // for money that was genuinely collected, so a desk-recorded fee must be
    // reversed in the desk, never by undoing the legacy panel underneath it.
    const paidFees = await selectRows<{ id: string }>(db, "case_fees", "id", [
      { col: "case_id", op: "eq", value: data.caseId },
      { col: "status", op: "eq", value: "paid" },
    ]);
    if (paidFees.length > 0) throw new Error("FEE_RECORDED_IN_DESK");

    // The referral trigger created a bounty from this fee event
    // (`referral_bounties.source_case_id`), and nulling the columns does not
    // remove it — the trigger returns early on nulls. Undoing the fee while a
    // bounty survives would leave the referrer owed 15% of money we just
    // unwound, so the bounty is settled here: deleted while it is still
    // pending, refused once it has been queued for or sent by FPS.
    const bounties = await selectRows<{ id: string; status: string }>(
      db,
      "referral_bounties",
      "id, status",
      [{ col: "source_case_id", op: "eq", value: data.caseId }],
    );
    const settled = bounties.find((b) => b.status !== "pending");
    if (settled) throw new Error("BOUNTY_SETTLED");

    if (bounties.length > 0) {
      const { error: bountyError } = await db
        .from<Row>("referral_bounties")
        .delete()
        .eq("source_case_id", data.caseId)
        .eq("status", "pending");
      if (bountyError) throw new Error(bountyError.message);
    }

    const { error } = await db
      .from<Row>("tutoring_cases")
      .update({ fee_collected_at: null, fee_amount_cents: null })
      .eq("id", data.caseId);
    if (error) throw new Error(error.message);
    await insertAudit(
      db,
      data.caseId,
      context.userId,
      null,
      "fee_undo_legacy",
      bounties.length > 0 ? "referral bounty removed" : null,
    );
    return { ok: true };
  });

/**
 * #816 §2.5: batch status from the admin list.
 *
 * This used to be a direct browser update over an id list, which meant two
 * things: no `case_audit` row per case, and the compliance-hold rule lived only
 * in the client, so a crafted request could move a held case. Both move here.
 */
export const deskBatchSetCaseStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(200),
        status: z.enum([
          "new",
          "contacted",
          "compliance_hold",
          "matched",
          "failed_trial_pivot",
          "released",
          "closed",
          "rejected",
        ]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ updated: number; skipped: number }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    // Bulk status write stays admin-only: it is destructive at scale (#816 §2.1).
    await requireAdmin(db, context.userId);

    const rows = await selectRows<{ id: string; status: string | null; case_code: string }>(
      db,
      "tutoring_cases",
      "id, status, case_code",
      [{ col: "id", op: "in", value: data.ids }],
    );

    // Issue #412: a held case is locked. Batch escalation skips it — but the
    // rule now belongs here, not to the caller.
    const escalating = data.status === "contacted" || data.status === "matched";
    const targets = rows.filter((r) => !(escalating && r.status === "compliance_hold"));
    const skipped = rows.length - targets.length;
    if (targets.length === 0) {
      throw new Error("Compliance hold: re-screen held cases individually before escalating.");
    }

    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "contacted") patch.last_contacted_at = new Date().toISOString();
    const { error } = await db
      .from<Row>("tutoring_cases")
      .update(patch)
      .in(
        "id",
        targets.map((t) => t.id),
      );
    if (error) throw new Error(error.message);

    for (const target of targets) {
      await insertAudit(
        db,
        target.id,
        context.userId,
        null,
        `batch_status:${data.status}`,
        `${target.case_code}: ${target.status ?? "none"} → ${data.status}`,
      );
    }

    return { updated: targets.length, skipped };
  });

// ---------------------------------------------------------------------------
// Lessons 1–2 (admin logs; both sides confirm; done/no_show/cancelled)
// ---------------------------------------------------------------------------

const lessonInput = z.object({
  caseId: z.string().uuid(),
  sequence: z.number().int().min(1).max(2),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hour: z.number().int().min(0).max(23).default(10),
  durationMin: z.number().int().min(15).max(480).default(60),
  locationOrLink: z.string().max(300).nullable().optional(),
});

export const lessonAdminLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => lessonInput.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireDeskStaff(db, context.userId);

    const cases = await selectRows<{ matched_tutor_id: string | null }>(
      db,
      "tutoring_cases",
      "matched_tutor_id",
      [{ col: "id", op: "eq", value: data.caseId }],
    );
    if (!cases[0]) throw new Error("CASE_NOT_FOUND");

    const existing = await selectRows<{ sequence: number }>(db, "case_lessons", "sequence", [
      { col: "case_id", op: "eq", value: data.caseId },
      { col: "sequence", op: "eq", value: data.sequence },
    ]);
    if (existing.length > 0) throw new Error("LESSON_EXISTS");

    // #760 overrun gate: desk-logged lessons respect the short package cap
    // too — convert the case to ongoing to log beyond its declared N.
    const shortRow = await selectRows<{
      is_short_case: boolean;
      scheduled_lesson_count: number | null;
    }>(db, "tutoring_cases", "is_short_case, scheduled_lesson_count", [
      { col: "id", op: "eq", value: data.caseId },
    ]);
    const overrun = shortCaseOverrunError({
      isShortCase: shortRow[0]?.is_short_case === true,
      scheduledLessonCount: shortRow[0]?.scheduled_lesson_count ?? null,
      lessonSequence: data.sequence,
    });
    if (overrun) throw new Error(overrun);

    const startsAt = hktFromParts(data.dateKey, data.hour * 60).toISOString();
    const { error } = await db
      .from<Row>("case_lessons")
      .insert({
        case_id: data.caseId,
        sequence: data.sequence,
        tutor_id: cases[0].matched_tutor_id,
        starts_at: startsAt,
        duration_min: data.durationMin,
        location_or_link: data.locationOrLink ?? null,
        status: "planned",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await insertAudit(
      db,
      data.caseId,
      context.userId,
      null,
      `lesson_${data.sequence}_logged`,
      startsAt,
    );
    return { ok: true };
  });

export const lessonAdminConfirm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ lessonId: z.string().uuid(), side: z.enum(["parent", "tutor"]) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ status: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireDeskStaff(db, context.userId);

    const rows = await selectRows<CaseLessonRow>(db, "case_lessons", "*", [
      { col: "id", op: "eq", value: data.lessonId },
    ]);
    const lesson = rows[0];
    if (!lesson) throw new Error("LESSON_NOT_FOUND");
    if (lesson.status !== "planned") throw new Error("NOT_PLANNED");

    // #760 overrun gate: confirming a lesson beyond a short package's
    // declared N requires the desk convert-to-ongoing first.
    const shortRow = await selectRows<{
      is_short_case: boolean;
      scheduled_lesson_count: number | null;
    }>(db, "tutoring_cases", "is_short_case, scheduled_lesson_count", [
      { col: "id", op: "eq", value: lesson.case_id },
    ]);
    const overrun = shortCaseOverrunError({
      isShortCase: shortRow[0]?.is_short_case === true,
      scheduledLessonCount: shortRow[0]?.scheduled_lesson_count ?? null,
      lessonSequence: lesson.sequence,
    });
    if (overrun) throw new Error(overrun);

    const patch: Row = {
      [data.side === "parent" ? "confirmed_by_parent_at" : "confirmed_by_tutor_at"]:
        new Date().toISOString(),
    };
    if (
      (data.side === "parent" && lesson.confirmed_by_tutor_at) ||
      (data.side === "tutor" && lesson.confirmed_by_parent_at)
    ) {
      patch.status = "confirmed";
    }
    const { error } = await db.from<Row>("case_lessons").update(patch).eq("id", lesson.id);
    if (error) throw new Error(error.message);
    await insertAudit(
      db,
      lesson.case_id,
      context.userId,
      lesson.status,
      String(patch.status ?? lesson.status),
      `admin confirmed for ${data.side}`,
    );
    return { status: String(patch.status ?? lesson.status) };
  });

export const lessonAdminMark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        lessonId: z.string().uuid(),
        status: z.enum(["done", "no_show", "cancelled"]),
        reason: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireDeskStaff(db, context.userId);

    const rows = await selectRows<CaseLessonRow>(db, "case_lessons", "*", [
      { col: "id", op: "eq", value: data.lessonId },
    ]);
    const lesson = rows[0];
    if (!lesson) throw new Error("LESSON_NOT_FOUND");
    if (lesson.status === "done") throw new Error("ALREADY_DONE");

    const patch: Row = { status: data.status };
    if (data.status === "done") {
      patch.marked_done_by = context.userId;
      patch.done_at = new Date().toISOString();
    }
    const { error } = await db.from<Row>("case_lessons").update(patch).eq("id", lesson.id);
    if (error) throw new Error(error.message);
    // no_show/cancelled never create fees (#201), no side effect here by design.
    await insertAudit(
      db,
      lesson.case_id,
      context.userId,
      lesson.status,
      data.status,
      data.reason ?? null,
    );
    // #760 Part 1: a desk mark of 'done' can deliver the L1/L2 (or short)
    // fee milestone — recalc the ledger (idempotent, no-op otherwise).
    if (data.status === "done") {
      await syncCaseFeeMilestones(db, lesson.case_id, "case_lesson");
    }
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Unpaid queue + audit + create
// ---------------------------------------------------------------------------

export type UnpaidQueueRow = {
  fee_id: string;
  case_id: string;
  case_code: string;
  contact_name: string | null;
  amount_hkd: number;
  due_at: string | null;
  whatsapp_group_url: string | null;
  tutor_name: string | null;
  tutor_code: string | null;
};

export const unpaidQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UnpaidQueueRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireDeskStaff(db, context.userId);

    const fees = await selectRows<{
      id: string;
      case_id: string;
      amount_hkd: number;
      due_at: string | null;
    }>(
      db,
      "case_fees",
      "id, case_id, amount_hkd, due_at",
      [{ col: "status", op: "eq", value: "invoiced" }],
      { col: "due_at", asc: true },
    );
    if (fees.length === 0) return [];

    const cases = await selectRows<
      SorCaseRow & { tutors: { display_name: string; tutor_code: string | null } | null }
    >(
      db,
      "tutoring_cases",
      "id, case_code, contact_name, whatsapp_group_url, tutors(display_name, tutor_code)",
      [{ col: "id", op: "in", value: fees.map((f) => f.case_id) }],
    );
    const caseById = new Map(cases.map((c) => [c.id, c]));
    return fees.map((f) => {
      const c = caseById.get(f.case_id);
      return {
        fee_id: f.id,
        case_id: f.case_id,
        case_code: c?.case_code ?? "",
        contact_name: c?.contact_name ?? null,
        amount_hkd: f.amount_hkd,
        due_at: f.due_at,
        whatsapp_group_url: c?.whatsapp_group_url ?? null,
        tutor_name: c?.tutors?.display_name ?? null,
        tutor_code: c?.tutors?.tutor_code ?? null,
      };
    });
  });

export const createSorCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        assignedTutorId: z.string().uuid(),
        parentAccountId: z.string().uuid().nullable().optional(),
        studentDisplayName: z.string().max(120).optional(),
        curriculum: z.string().max(60).nullable().optional(),
        subject: z.string().max(60).nullable().optional(),
        level: z.string().max(60).nullable().optional(),
        station: z.string().max(60).nullable().optional(),
        lessonMode: z.enum(["f2f", "online"]).nullable().optional(),
        hourlyRateHkd: z.number().positive().nullable().optional(),
        whatsappGroupUrl: z.string().max(300).nullable().optional(),
        internalNote: z.string().max(1000).nullable().optional(),
        source: z.string().max(30).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ caseId: string; caseCode: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireDeskStaff(db, context.userId);
    // #782: a new case with an assigned tutor is an introduction.
    const { assertTutorCanBeIntroduced, assertParentCanBeMatched } =
      await import("@/features/trust/match-eligibility.server");
    await assertTutorCanBeIntroduced(db, data.assignedTutorId);
    await assertParentCanBeMatched(db, data.parentAccountId ?? null);

    const { data: caseId, error } = await db.rpc("admin_create_sor_case", {
      _payload: {
        assigned_tutor_id: data.assignedTutorId,
        parent_account_id: data.parentAccountId ?? null,
        concierge_id: context.userId,
        student_display_name: data.studentDisplayName ?? null,
        curriculum: data.curriculum ?? null,
        subject: data.subject ?? null,
        level: data.level ?? null,
        station: data.station ?? null,
        lesson_mode: data.lessonMode ?? null,
        hourly_rate_hkd: data.hourlyRateHkd ?? null,
        whatsapp_group_url: data.whatsappGroupUrl ?? null,
        internal_note: data.internalNote ?? null,
        source: data.source ?? "whatsapp",
      },
    });
    if (error) throw new Error(error.message ?? "create failed");
    const id = caseId as string;
    const rows = await selectRows<{ case_code: string }>(db, "tutoring_cases", "case_code", [
      { col: "id", op: "eq", value: id },
    ]);
    return { caseId: id, caseCode: rows[0]?.case_code ?? "" };
  });

// ---------------------------------------------------------------------------
// Case flags (issue #254 / F3), staff-only, service-role table
// ---------------------------------------------------------------------------

export type DeskCaseFlag = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  reason: CaseFlagReason;
  note: string | null;
  created_at: string;
};

export const listCaseFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<DeskCaseFlag[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireDeskStaff(db, context.userId);
    return selectRows<DeskCaseFlag>(
      db,
      "case_flags",
      "id, actor_id, actor_name, reason, note, created_at",
      [{ col: "case_id", op: "eq", value: data.caseId }],
      { col: "created_at", asc: false, limit: 50 },
    );
  });

export const flagCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        reason: z.string(),
        note: z.string().max(500).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireDeskStaff(db, context.userId);

    const row = buildCaseFlagRow({
      caseId: data.caseId,
      actorId: context.userId,
      actorName: null, // desk fns have no profile read here; the flag keeps the actor id
      reason: data.reason,
      note: data.note ?? null,
    });
    const { error } = await db.from<Row>("case_flags").insert(row);
    if (error) throw new Error(error.message ?? "flag failed");
    return { ok: true };
  });
