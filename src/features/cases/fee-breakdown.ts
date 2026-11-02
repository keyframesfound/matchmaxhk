/**
 * #385, admin fee breakdown: 100% Lesson 1 + 50% Lesson 2 = 1.5 lessons.
 *
 * Pure helpers so the desk UI (and vitest) can compute the three preset
 * invoice amounts and the paid-progress state from existing case_fees rows.
 * Amounts round to whole HKD (parents pay whole-dollar FPS transfers).
 *
 * Group scaling (#391): every helper takes an optional studentCount (the
 * case's student_count, 1 for legacy rows) and rounds the TOTAL, so a group
 * case pays 1.5 × per-student rate × student count as one whole-dollar sum
 * (0.5 × $333 × 3 → $500, not 3 × $167).
 */

export const LESSON1_MULTIPLIER = 1.0;
export const LESSON2_BALANCE_MULTIPLIER = 0.5;
export const FULL_ADMIN_MULTIPLIER = 1.5;

/** Minimal shape of a case_fees row the desk already loads. */
export type FeeBreakdownFeeRow = {
  status: string;
  amount_hkd: number | string | null;
};

/** Whole-dollar positive count, 1 for every legacy (non-group) case. */
function normalizeStudentCount(studentCount: number | null | undefined): number {
  return Number.isInteger(studentCount) && (studentCount as number) >= 1
    ? (studentCount as number)
    : 1;
}

/** 100% of Lesson 1 per student, accrued the moment Lesson 1 is marked done. */
export function lesson1Amount(rateHkd: number, studentCount?: number): number {
  return Math.round(rateHkd * normalizeStudentCount(studentCount) * LESSON1_MULTIPLIER);
}

/** Remaining 50% of Lesson 2, invoiced after Lesson 2 when 1.0× L1 was paid. */
export function lesson2BalanceAmount(rateHkd: number, studentCount?: number): number {
  return Math.round(rateHkd * normalizeStudentCount(studentCount) * LESSON2_BALANCE_MULTIPLIER);
}

/** Full 1.5-lesson admin fee (100% L1 + 50% L2), scaled by student count. */
export function fullAdminFeeAmount(rateHkd: number, studentCount?: number): number {
  return Math.round(rateHkd * normalizeStudentCount(studentCount) * FULL_ADMIN_MULTIPLIER);
}

/**
 * #461 §12.8 / #468 rebate: the L2 tranche becomes 0.25R, L1 stays 1.0R, so
 * the full admin fee is 1.25R. Same whole-HKD Math.round as the base helpers.
 */
export const LESSON2_REBATE_MULTIPLIER = 0.25;
export const FULL_ADMIN_WITH_REBATE_MULTIPLIER = 1.25;

export function lesson2BalanceAmountWithRebate(rateHkd: number, studentCount?: number): number {
  return Math.round(rateHkd * normalizeStudentCount(studentCount) * LESSON2_REBATE_MULTIPLIER);
}

export function fullAdminFeeAmountWithRebate(rateHkd: number, studentCount?: number): number {
  return Math.round(
    rateHkd * normalizeStudentCount(studentCount) * FULL_ADMIN_WITH_REBATE_MULTIPLIER,
  );
}

export type AdminFeeQuoteInput = {
  rateHkd: number;
  studentCount?: number;
  /** When true, this PLATFORM_MATCH_1_5 case uses the 1.25R split (#468). */
  applyFeeRebate0_25?: boolean;
};

export type AdminFeeQuote = { l1Hkd: number; l2Hkd: number; totalHkd: number; multiplier: number };

/** The single call site #468 uses to invoice a platform match with or without the rebate. */
export function quotePlatformAdminFee(input: AdminFeeQuoteInput): AdminFeeQuote {
  const l1 = lesson1Amount(input.rateHkd, input.studentCount);
  const l2 = input.applyFeeRebate0_25
    ? lesson2BalanceAmountWithRebate(input.rateHkd, input.studentCount)
    : lesson2BalanceAmount(input.rateHkd, input.studentCount);
  return {
    l1Hkd: l1,
    l2Hkd: l2,
    totalHkd: l1 + l2,
    multiplier: input.applyFeeRebate0_25
      ? FULL_ADMIN_WITH_REBATE_MULTIPLIER
      : FULL_ADMIN_MULTIPLIER,
  };
}

export type FeePaidState = "none" | "partial_l1" | "full";

/**
 * Paid progress against the 1.5× target, from existing fee rows:
 * - "full"      , paid sums cover the full 1.5× target
 * - "partial_l1", paid sums cover at least the 1.0× Lesson 1 portion
 * - "none"      , nothing paid (or only odd sub-L1 custom invoices)
 * Waived / refunded rows never count toward the paid sum.
 */
export function derivePaidState(
  fees: FeeBreakdownFeeRow[],
  rateHkd: number | null | undefined,
  studentCount?: number,
): FeePaidState {
  if (!Number.isFinite(rateHkd) || (rateHkd as number) <= 0) return "none";
  const rate = Number(rateHkd);
  const count = normalizeStudentCount(studentCount);
  const paidSum = fees.reduce<number>((sum, f) => {
    if (f.status !== "paid") return sum;
    const n = Number(f.amount_hkd);
    return Number.isFinite(n) && n > 0 ? sum + n : sum;
  }, 0);
  if (paidSum <= 0) return "none";
  if (paidSum >= fullAdminFeeAmount(rate, count)) return "full";
  if (paidSum >= lesson1Amount(rate, count)) return "partial_l1";
  return "none";
}
