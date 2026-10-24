/**
 * #385 — admin fee breakdown: 100% Lesson 1 + 50% Lesson 2 = 1.5 lessons.
 *
 * Pure helpers so the desk UI (and vitest) can compute the three preset
 * invoice amounts and the paid-progress state from existing case_fees rows.
 * Amounts round to whole HKD (parents pay whole-dollar FPS transfers).
 *
 * Group scaling (#385): tutoring_cases has no student_count column yet —
 * every helper here computes ×1 per case. Scaling by student_count lands
 * with issue #391.
 */

export const LESSON1_MULTIPLIER = 1.0;
export const LESSON2_BALANCE_MULTIPLIER = 0.5;
export const FULL_ADMIN_MULTIPLIER = 1.5;

/** Minimal shape of a case_fees row the desk already loads. */
export type FeeBreakdownFeeRow = {
  status: string;
  amount_hkd: number | string | null;
};

/** 100% of Lesson 1 — accrued the moment Lesson 1 is marked done. */
export function lesson1Amount(rateHkd: number): number {
  return Math.round(rateHkd * LESSON1_MULTIPLIER);
}

/** Remaining 50% of Lesson 2 — invoiced after Lesson 2 when 1.0× L1 was paid. */
export function lesson2BalanceAmount(rateHkd: number): number {
  return Math.round(rateHkd * LESSON2_BALANCE_MULTIPLIER);
}

/** Full 1.5-lesson admin fee (100% L1 + 50% L2) in one invoice. */
export function fullAdminFeeAmount(rateHkd: number): number {
  return Math.round(rateHkd * FULL_ADMIN_MULTIPLIER);
}

export type FeePaidState = "none" | "partial_l1" | "full";

/**
 * Paid progress against the 1.5× target, from existing fee rows:
 * - "full"       — paid sums cover the full 1.5× target
 * - "partial_l1" — paid sums cover at least the 1.0× Lesson 1 portion
 * - "none"       — nothing paid (or only odd sub-L1 custom invoices)
 * Waived / refunded rows never count toward the paid sum.
 */
export function derivePaidState(
  fees: FeeBreakdownFeeRow[],
  rateHkd: number | null | undefined,
): FeePaidState {
  if (!Number.isFinite(rateHkd) || (rateHkd as number) <= 0) return "none";
  const rate = Number(rateHkd);
  const paidSum = fees.reduce<number>((sum, f) => {
    if (f.status !== "paid") return sum;
    const n = Number(f.amount_hkd);
    return Number.isFinite(n) && n > 0 ? sum + n : sum;
  }, 0);
  if (paidSum <= 0) return "none";
  if (paidSum >= fullAdminFeeAmount(rate)) return "full";
  if (paidSum >= lesson1Amount(rate)) return "partial_l1";
  return "none";
}
