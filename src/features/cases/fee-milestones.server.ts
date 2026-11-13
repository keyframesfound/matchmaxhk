/**
 * Issue #760 Part 1 (was #615) — attendance-tied admin-fee milestone ledger,
 * server-side sync executor.
 *
 * ONE function every attendance writer calls after it commits its counter
 * change (all callers run on the service-role client):
 *   * #613 roster path — saveAttendance / editAttendance / voidSession
 *     (source "roster_attendance"),
 *   * #533 case-lessons path — academy recordAttendance and the desk
 *     lessonAdminMark (source "case_lesson").
 *
 * The sync is IDEMPOTENT and recalc-shaped: it recomputes the plan from the
 * CURRENT completed-lesson counter and diffs it against the stored rows, so
 * a void inside the 24h correction window flips a delivered milestone back
 * to pending without any special-casing at the call sites. All rules live in
 * the pure half (fee-milestones.ts, vitest-covered); this file only loads
 * rows and executes the diff.
 *
 * Founder lock: ledger status ONLY — the optional auto-invoice writes a
 * case_fees row as 'invoiced' (desk chases it exactly like its manual
 * invoices; see autoInvoiceDecision for when it fires) and never collects
 * money.
 */

import { asAdminDb } from "@/features/materials/storage-helpers";
import { isLegalTransition, type SorStatus } from "@/features/cases/sor";
import { feeDueAtFrom } from "@/features/cases/sor";
import { sourceTagForRoster, type SourceType } from "@/features/rosters/roster-logic";
import {
  autoInvoiceDecision,
  milestonePlan,
  plannedWrites,
  type ExistingMilestone,
  type MilestoneKind,
  type MilestoneSource,
  type MilestoneWrite,
} from "@/features/cases/fee-milestones";

type Row = Record<string, unknown>;
type MilestoneDb = ReturnType<typeof asAdminDb>;

async function selectRows<T extends Row>(
  db: MilestoneDb,
  table: string,
  cols: string,
  match: { col: string; op: "eq" | "in"; value: unknown }[],
  order?: { col: string; asc?: boolean; limit?: number },
): Promise<T[]> {
  let q = db.from<T>(table).select(cols);
  for (const m of match) {
    if (m.op === "eq") q = q.eq(m.col, m.value);
    else q = q.in(m.col, m.value as unknown[]);
  }
  if (order) q = q.order(order.col, { ascending: order.asc ?? true });
  if (order?.limit) q = q.limit(order.limit);
  const { data } = await q;
  return (data ?? []) as T[];
}

type CaseSnapshot = {
  id: string;
  hourly_rate_hkd: number | null;
  student_count: number;
  is_short_case: boolean;
  scheduled_lesson_count: number | null;
  session_length_minutes: number | null;
  package_type: string | null;
  sor_status: string | null;
};

/**
 * Recalculate the fee-milestone ledger for one case from its CURRENT
 * attendance state. Best called right after the writer committed its
 * counter/attendance change. Never throws on a missing case — a roster row
 * without a resolvable case simply has nothing to stamp.
 */
export async function syncCaseFeeMilestones(
  db: MilestoneDb,
  caseId: string,
  source: MilestoneSource,
): Promise<void> {
  const cases = await selectRows<CaseSnapshot>(
    db,
    "tutoring_cases",
    "id, hourly_rate_hkd, student_count, is_short_case, scheduled_lesson_count, session_length_minutes, package_type, sor_status",
    [{ col: "id", op: "eq", value: caseId }],
  );
  const kase = cases[0];
  if (!kase) return;

  // Enrollment source: a linked roster decides MATCHMAX_MATCHED vs
  // SELF_BROUGHT (#613); a case with no roster is a platform match (fees
  // apply). SELF_BROUGHT students are HK$0 — the plan comes back empty and
  // the sync is a no-op.
  let sourceTag: "matchmax_matched" | "self_brought" = "matchmax_matched";
  let completedCount: number | null = null;
  const rosterRows = await selectRows<{ id: string; source_type: SourceType }>(
    db,
    "rosters",
    "id, source_type",
    [{ col: "case_id", op: "eq", value: caseId }],
    { col: "created_at", asc: true, limit: 1 },
  );
  const roster = rosterRows[0];
  if (roster) {
    sourceTag = sourceTagForRoster(roster.source_type);
    const students = await selectRows<{ completed_lesson_count: number }>(
      db,
      "roster_students",
      "completed_lesson_count",
      [{ col: "roster_id", op: "eq", value: roster.id }],
    );
    completedCount = students.reduce<number>(
      (max, s) => Math.max(max, Number(s.completed_lesson_count ?? 0)),
      0,
    );
  }
  if (sourceTag === "self_brought") return;

  if (completedCount == null) {
    // No roster: count finished case_lessons (#533 attendance mark or desk
    // mark). PRESENT/LATE map to status 'done'; a lesson done BEFORE the
    // attendance columns existed (legacy rows with attendance NULL) counts —
    // a 'done' lesson was attended. no_show/cancelled never count.
    const lessons = await selectRows<{ id: string }>(
      db,
      "case_lessons",
      "id",
      [
        { col: "case_id", op: "eq", value: caseId },
        { col: "status", op: "eq", value: "done" },
      ],
      undefined,
    );
    completedCount = lessons.length;
  }

  const plan = milestonePlan({
    completedCount,
    isShortCase: kase.is_short_case === true,
    declaredLessonCount: kase.scheduled_lesson_count,
    sourceTag,
  });

  const existingRows = await selectRows<ExistingMilestone>(
    db,
    "case_fee_milestones",
    "kind, status, amount_hkd, delivered_source",
    [{ col: "case_id", op: "eq", value: caseId }],
  );
  const nowIso = new Date().toISOString();
  const writes: MilestoneWrite[] = plannedWrites(plan, existingRows, {
    rateHkd: kase.hourly_rate_hkd == null ? null : Number(kase.hourly_rate_hkd),
    studentCount: kase.student_count,
    sessionLengthMinutes: kase.session_length_minutes,
    declaredLessonCount: kase.scheduled_lesson_count,
    packageType: kase.package_type,
    source,
    nowIso,
  });
  const existingKinds = new Set(existingRows.map((row) => row.kind));
  for (const w of writes) {
    if (existingKinds.has(w.kind)) {
      const { error } = await db
        .from<Row>("case_fee_milestones")
        .update({
          status: w.status,
          amount_hkd: w.amountHkd,
          delivered_at: w.deliveredAt,
          delivered_source: w.deliveredSource,
          updated_at: nowIso,
        } as Row)
        .eq("case_id", caseId)
        .eq("kind", w.kind);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db
        .from<Row>("case_fee_milestones")
        .insert({
          case_id: caseId,
          kind: w.kind,
          status: w.status,
          amount_hkd: w.amountHkd,
          delivered_at: w.deliveredAt,
          delivered_source: w.deliveredSource,
        } as Row)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
    }
  }

  await maybeAutoInvoice(
    db,
    kase,
    plan.filter((p) => p.delivered).map((p) => p.kind),
    nowIso,
  );
}

/**
 * The #756 "automated calculation of the exact HKD admin fee" leg: at most
 * ONE auto-invoice per case, only when the desk has NOT invoiced anything
 * yet (zero fee rows of any status). Creates an 'invoiced' case_fees row the
 * desk then chases with its existing flow; advances sor_status only across a
 * legal edge. Money never moves.
 */
async function maybeAutoInvoice(
  db: MilestoneDb,
  kase: CaseSnapshot,
  deliveredKinds: readonly MilestoneKind[],
  nowIso: string,
): Promise<void> {
  const feeRows = await selectRows<{ id: string }>(db, "case_fees", "id", [
    { col: "case_id", op: "eq", value: kase.id },
  ]);
  const decision = autoInvoiceDecision({
    feeRowCount: feeRows.length,
    deliveredKinds,
    isShortCase: kase.is_short_case === true,
    declaredLessonCount: kase.scheduled_lesson_count,
    packageType: kase.package_type,
    rateHkd: kase.hourly_rate_hkd == null ? null : Number(kase.hourly_rate_hkd),
    studentCount: kase.student_count,
    sessionLengthMinutes: kase.session_length_minutes,
  });
  if (!decision.create) return;

  const { error } = await db
    .from<Row>("case_fees")
    .insert({
      case_id: kase.id,
      rate_hkd: kase.hourly_rate_hkd,
      multiplier: decision.multiplier,
      amount_hkd: decision.amountHkd,
      status: "invoiced",
      due_at: feeDueAtFrom(new Date()).toISOString(),
    } as Row)
    .select("id")
    .single();
  if (error) {
    // A concurrent desk invoice (or a raced sync) hit the one-open-fee
    // unique index — the desk row wins, ours is redundant by design.
    if (/duplicate|unique/i.test(error.message)) return;
    throw new Error(error.message);
  }

  const { error: auditError } = await db
    .from<Row>("case_audit")
    .insert({
      case_id: kase.id,
      actor_id: null,
      from_status: null,
      to_status: "fee_invoiced",
      reason: `#760 auto-invoice (${decision.label}): HK$${decision.amountHkd} — attendance milestone delivery, ledger only`,
    } as Row)
    .select("id")
    .single();
  if (auditError) throw new Error(auditError.message);

  const fromStatus = kase.sor_status as SorStatus | null;
  if (fromStatus && isLegalTransition(fromStatus, "fee_invoiced")) {
    const { error: advanceError } = await db
      .from<Row>("tutoring_cases")
      .update({ sor_status: "fee_invoiced", sor_status_at: nowIso } as Row)
      .eq("id", kase.id);
    if (advanceError) throw new Error(advanceError.message);
  }
}
