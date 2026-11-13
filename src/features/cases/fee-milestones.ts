/**
 * Issue #760 Part 1 (was #615) — attendance-tied admin-fee milestone ledger,
 * pure half.
 *
 * The Fee SoT (do not reopen economics):
 *   * Standard / ongoing matched case (6+ lessons or undeclared ongoing):
 *     1.5 lessons — 100% of Lesson 1 (milestone `lesson_1_100`) + 50% of
 *     Lesson 2 (`lesson_2_50`).
 *   * Short matched case (declared 1–5 lessons at intake): the 20%
 *     short-course fee (`short_course_20`), stamped once the first lesson is
 *     delivered (booking-time invoicing for 1-lesson packages stays the desk
 *     button — no attendance exists to stamp).
 *   * SELF_BROUGHT roster students: HK$0 — no milestone rows at all.
 *
 * Milestones are DELIVERY EVIDENCE only: they timestamp when attendance
 * proved the lesson happened. They never move money and never change the
 * drop math (#525/#508/#672 stay in fee-drop.ts). Attendance counters:
 * PRESENT + LATE count (roster: roster_attendance present/late; case
 * lessons: status 'done'); ABSENT_* and voided sessions do not. A void
 * inside the 24h correction window flips a delivered milestone back to
 * pending (the sync is a pure function of the CURRENT counter — recalc, not
 * append-only).
 *
 * Amounts reuse the existing engines (never a second fee engine):
 * fee-breakdown.ts for the 1.0 / 0.5 / 1.5 tranches, short-case.ts for the
 * 20% package fee. Auto-invoicing is deliberately minimal (see
 * autoInvoiceDecision): the desk keeps its manual tranche/lump-sum flow.
 */

import {
  fullAdminFeeAmount,
  lesson1Amount,
  lesson2BalanceAmount,
} from "@/features/cases/fee-breakdown";
import {
  SHORT_CASE_MAX_LESSONS,
  hoursPerLessonFromMinutes,
  shortCaseFeeAmount,
  shortCaseFeeMultiplier,
} from "@/features/cases/short-case";

export const MILESTONE_KINDS = ["lesson_1_100", "lesson_2_50", "short_course_20"] as const;
export type MilestoneKind = (typeof MILESTONE_KINDS)[number];

export type MilestoneStatus = "pending" | "delivered";

/** Where the attendance evidence came from (mirrors the DB delivered_source). */
export type MilestoneSource = "roster_attendance" | "case_lesson";

/** Minimal shape of an existing case_fee_milestones row the sync loads. */
export type ExistingMilestone = {
  kind: string;
  status: string;
  amount_hkd: number | string | null;
  delivered_source: string | null;
};

export type PlannedMilestone = { kind: MilestoneKind; delivered: boolean };

/**
 * Standard ongoing: L1 (100%) delivered at completed ≥ 1, L2 (50%) at ≥ 2.
 * `completedCount` is the non-voided PRESENT+LATE session count.
 */
export function standardMilestonePlan(completedCount: number): PlannedMilestone[] {
  const count =
    Number.isFinite(completedCount) && completedCount > 0 ? Math.floor(completedCount) : 0;
  return [
    { kind: "lesson_1_100", delivered: count >= 1 },
    { kind: "lesson_2_50", delivered: count >= 2 },
  ];
}

/**
 * Declared short engagement (1–5 lessons): the single 20% milestone is
 * delivered by the first completed lesson (fee timing per the #760
 * addendum: due at booking when N = 1 — the desk invoices that at booking —
 * otherwise immediately after Lesson 1).
 */
export function shortMilestonePlan(
  declaredLessonCount: number | null | undefined,
  completedCount: number,
): PlannedMilestone[] {
  const n = Number(declaredLessonCount);
  if (!Number.isInteger(n) || n < 1 || n > SHORT_CASE_MAX_LESSONS) return [];
  const count =
    Number.isFinite(completedCount) && completedCount > 0 ? Math.floor(completedCount) : 0;
  return [{ kind: "short_course_20", delivered: count >= 1 }];
}

export type MilestonePlanInput = {
  completedCount: number;
  /** Declared ≤5 package at intake (is_short_case / scheduled_lesson_count). */
  isShortCase: boolean;
  declaredLessonCount: number | null | undefined;
  /**
   * SELF_BROUGHT single-player students pay HK$0 — no commission
   * milestones, ever. Only the roster path can be self-brought (a platform
   * matched case is always MATCHMAX_MATCHED).
   */
  sourceTag?: "matchmax_matched" | "self_brought";
};

/** The one plan entry point per #615 step 2. */
export function milestonePlan(input: MilestonePlanInput): PlannedMilestone[] {
  if (input.sourceTag === "self_brought") return [];
  return input.isShortCase
    ? shortMilestonePlan(input.declaredLessonCount, input.completedCount)
    : standardMilestonePlan(input.completedCount);
}

/** Whole-HKD snapshot for a milestone kind, from the SAME engines the desk invoices with. */
export function milestoneAmountHkd(
  kind: MilestoneKind,
  input: {
    rateHkd: number | null;
    studentCount?: number;
    sessionLengthMinutes: number | null | undefined;
    declaredLessonCount: number | null | undefined;
    packageType: string | null | undefined;
  },
): number | null {
  if (input.rateHkd == null) return null;
  const rate = Number(input.rateHkd);
  if (!Number.isFinite(rate) || rate < 0) return null;
  if (kind === "lesson_1_100") return lesson1Amount(rate, input.studentCount);
  if (kind === "lesson_2_50") return lesson2BalanceAmount(rate, input.studentCount);
  const hours = hoursPerLessonFromMinutes(input.sessionLengthMinutes);
  const n = Number(input.declaredLessonCount);
  if (hours == null || !Number.isInteger(n) || n < 1 || n > SHORT_CASE_MAX_LESSONS) return null;
  return shortCaseFeeAmount({
    rateHkd: rate,
    hoursPerLesson: hours,
    scheduledLessonCount: n,
    packageType: input.packageType,
  });
}

/**
 * Package burn-down badge (#615 step 3): show the renewal nudge when the
 * remaining package lessons ≤ 1. Null when the enrollment has no declared
 * package (nothing to burn down).
 */
export function renewalBadgeFor(
  packageLessonCount: number | null | undefined,
  completedCount: number,
): { remaining: number; showBadge: boolean } | null {
  const total = Number(packageLessonCount);
  if (!Number.isInteger(total) || total <= 0) return null;
  const done =
    Number.isFinite(completedCount) && completedCount > 0 ? Math.floor(completedCount) : 0;
  const remaining = Math.max(0, total - done);
  return { remaining, showBadge: remaining <= 1 };
}

// ---------------------------------------------------------------------------
// Sync write plan (pure diff so the server fn stays a thin executor)
// ---------------------------------------------------------------------------

export type MilestoneWrite = {
  kind: MilestoneKind;
  status: MilestoneStatus;
  /** Whole-HKD snapshot; refreshed on every sync (rate/package edits replay). */
  amountHkd: number | null;
  deliveredAt: string | null;
  deliveredSource: MilestoneSource | null;
};

/** Internal row shape the sync upserts (kind is unique per case). */
export function plannedWrites(
  plan: PlannedMilestone[],
  existing: readonly ExistingMilestone[],
  input: {
    rateHkd: number | null;
    studentCount?: number;
    sessionLengthMinutes: number | null | undefined;
    declaredLessonCount: number | null | undefined;
    packageType: string | null | undefined;
    source: MilestoneSource;
    nowIso: string;
  },
): MilestoneWrite[] {
  const existingByKind = new Map(existing.map((row) => [row.kind, row]));
  const writes: MilestoneWrite[] = [];
  for (const step of plan) {
    const current = existingByKind.get(step.kind);
    const nextStatus: MilestoneStatus = step.delivered ? "delivered" : "pending";
    const amount = milestoneAmountHkd(step.kind, input);
    const unchanged =
      current != null &&
      current.status === nextStatus &&
      (current.status === "pending" || current.delivered_source === input.source);
    if (unchanged && amountsEqual(current?.amount_hkd, amount)) continue;
    writes.push({
      kind: step.kind,
      status: nextStatus,
      amountHkd: amount,
      deliveredAt: step.delivered ? input.nowIso : null,
      deliveredSource: step.delivered ? input.source : null,
    });
  }
  return writes;
}

function amountsEqual(dbValue: number | string | null | undefined, fresh: number | null): boolean {
  if (dbValue == null && fresh == null) return true;
  if (dbValue == null || fresh == null) return false;
  return Number(dbValue) === fresh;
}

// ---------------------------------------------------------------------------
// Auto-invoice decision (#756: "automated calculation of exact HKD admin fee
// due … upon Lesson 1 & Lesson 2 logging"; Founder lock: ledger status only,
// collection stays the desk). ONE rule, deliberately minimal:
//   * the desk keeps its manual tranche / lump-sum flow — auto-invoice only
//     ever fires when the case has ZERO fee rows (a desk intervention always
//     wins and is never duplicated or second-guessed);
//   * short case: the 20% package fee invoices at the first completed lesson
//     (N = 1 stays the desk's booking-time button);
//   * standard: the full 1.5-lesson fee invoices at the L2 milestone (the
//     L1 1.0× tranche stays a desk option — the one-open-fee unique index
//     cannot hold a paid L1 plus an open L2 side by side).
// Money never moves here: the row lands as 'invoiced' for the desk to chase.
// ---------------------------------------------------------------------------

export type AutoInvoiceDecision =
  | {
      create: false;
      reason: "rows_exist" | "nothing_due" | "pro_bono" | "no_rate" | "bad_package_shape";
    }
  | {
      create: true;
      multiplier: number;
      amountHkd: number;
      label: "full_admin" | "short_case";
    };

export function autoInvoiceDecision(input: {
  /** case_fees rows already on the case (ANY status counts — desk wins). */
  feeRowCount: number;
  deliveredKinds: readonly MilestoneKind[];
  isShortCase: boolean;
  declaredLessonCount: number | null | undefined;
  packageType: string | null | undefined;
  rateHkd: number | null;
  studentCount?: number;
  sessionLengthMinutes: number | null | undefined;
}): AutoInvoiceDecision {
  if (input.packageType === "pro_bono") return { create: false, reason: "pro_bono" };
  if (
    input.rateHkd == null ||
    !Number.isFinite(Number(input.rateHkd)) ||
    Number(input.rateHkd) <= 0
  ) {
    return { create: false, reason: "no_rate" };
  }
  if (input.feeRowCount > 0) return { create: false, reason: "rows_exist" };
  const rate = Number(input.rateHkd);

  if (input.isShortCase) {
    const hours = hoursPerLessonFromMinutes(input.sessionLengthMinutes);
    const n = Number(input.declaredLessonCount);
    const shapeOk = hours != null && Number.isInteger(n) && n >= 1 && n <= SHORT_CASE_MAX_LESSONS;
    if (!shapeOk) return { create: false, reason: "bad_package_shape" };
    if (!input.deliveredKinds.includes("short_course_20")) {
      return { create: false, reason: "nothing_due" };
    }
    return {
      create: true,
      multiplier: shortCaseFeeMultiplier(hours as number, n),
      amountHkd: shortCaseFeeAmount({
        rateHkd: rate,
        hoursPerLesson: hours as number,
        scheduledLessonCount: n,
        packageType: input.packageType,
      }),
      label: "short_case",
    };
  }

  if (!input.deliveredKinds.includes("lesson_2_50"))
    return { create: false, reason: "nothing_due" };
  return {
    create: true,
    multiplier: 1.5,
    amountHkd: fullAdminFeeAmount(rate, input.studentCount),
    label: "full_admin",
  };
}
