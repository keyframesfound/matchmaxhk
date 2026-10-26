/**
 * Issue #443 — Short-Case Handling (≤5 lessons, 20% package fee).
 *
 * Pure helpers so the desk server fns, the admin panel and the vitest suite
 * share ONE auditable fee formula (CEO lock 2026-10-24 — payer is always the
 * self-employed tutor):
 *
 *   hours_per_lesson = session_length_minutes / 60     (DERIVED — no DB column)
 *   package_value    = hourly_rate_hkd × hours_per_lesson × scheduled_lesson_count
 *   short_case_fee   = package_value × 0.20            (whole HKD)
 *   Pro-Bono         → 0  ($0 wins over the short 20%)
 *   convert balance  = max(0, standard_1_5_fee − amount_already_invoiced)
 *
 * Duration REUSES the existing tutoring_cases.session_length_minutes (shared
 * duration lock, CEO check 2026-10-24) — hours per lesson are derived here,
 * never stored. The standard 1.5-lesson math is NOT re-derived here — #385's
 * fullAdminFeeAmount (rate × 1.5 × students) stays the single source for the
 * ongoing rule; the convert path imports it so the two rules can never drift.
 * Amounts round to whole HKD (FPS transfers are whole-dollar, #385 precedent).
 */

export const SHORT_CASE_MAX_LESSONS = 5;
export const SHORT_CASE_FEE_RATE = 0.2;

/** Who confirmed the fee with the payer (the pasted WA text lives in case_notes). */
export const SHORT_CASE_CONFIRMED_BY_OPTIONS = ["parent_wa", "org_wa", "cs_note"] as const;
export type ShortCaseConfirmedBy = (typeof SHORT_CASE_CONFIRMED_BY_OPTIONS)[number];

/**
 * Derived hours per lesson from the case's EXISTING session_length_minutes
 * (e.g. 90 min → 1.5 h). Returns null for missing / non-positive minutes so
 * callers can render "inputs incomplete" instead of a lying fee.
 */
export function hoursPerLessonFromMinutes(
  sessionLengthMinutes: number | null | undefined,
): number | null {
  const m = Number(sessionLengthMinutes);
  if (!Number.isFinite(m) || m <= 0) return null;
  return m / 60;
}

export type ShortCaseInputError =
  "COUNT_REQUIRED" | "COUNT_RANGE" | "MINUTES_REQUIRED" | "MINUTES_INVALID";

/**
 * Validate the desk inputs BEFORE the confirm gate. Returns the first error or
 * null when the pair is a legal short-package shape (count 1–5 whole, session
 * length a positive number of minutes — the duration lock: no hours column,
 * the existing session_length_minutes carries the duration).
 */
export function validateShortCaseInputs(input: {
  scheduledLessonCount: unknown;
  sessionLengthMinutes: unknown;
}): ShortCaseInputError | null {
  const count = input.scheduledLessonCount;
  if (count === null || count === undefined || count === "") return "COUNT_REQUIRED";
  const n = Number(count);
  if (!Number.isInteger(n) || n < 1 || n > SHORT_CASE_MAX_LESSONS) return "COUNT_RANGE";
  const minutes = input.sessionLengthMinutes;
  if (minutes === null || minutes === undefined || minutes === "") return "MINUTES_REQUIRED";
  const m = Number(minutes);
  if (!Number.isFinite(m) || m <= 0) return "MINUTES_INVALID";
  return null;
}

/** Scheduled package value in HKD: rate × hours × lessons. */
export function shortCasePackageValueHkd(
  rateHkd: number,
  hoursPerLesson: number,
  scheduledLessonCount: number,
): number {
  const rate = Number(rateHkd);
  const hours = Number(hoursPerLesson);
  const count = Number(scheduledLessonCount);
  if (!Number.isFinite(rate) || rate < 0) return 0;
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  if (!Number.isInteger(count) || count < 1 || count > SHORT_CASE_MAX_LESSONS) return 0;
  // Whole units first, then round once — avoids the 333 × 1.3 float trap.
  return Math.round(rate * hours * count);
}

/**
 * The 20% short-case platform fee in whole HKD. Pro-Bono ALWAYS wins ($0) —
 * pass packageType through from the case row.
 */
export function shortCaseFeeAmount(input: {
  rateHkd: number;
  hoursPerLesson: number;
  scheduledLessonCount: number;
  packageType: string | null | undefined;
}): number {
  if (input.packageType === "pro_bono") return 0;
  const value = shortCasePackageValueHkd(
    input.rateHkd,
    input.hoursPerLesson,
    input.scheduledLessonCount,
  );
  return Math.round(value * SHORT_CASE_FEE_RATE);
}

/**
 * The case_fees multiplier that reproduces the short fee from the rate alone
 * (amount = rate_hkd × multiplier): 0.2 × hours × count. Rounded to 4 dp so
 * odd session lengths (e.g. 55 min → 0.9167 h) stay lossless enough for the
 * desk display; the stored amount_hkd snapshot is the billing truth.
 */
export function shortCaseFeeMultiplier(
  hoursPerLesson: number,
  scheduledLessonCount: number,
): number {
  return (
    Math.round(
      SHORT_CASE_FEE_RATE * Number(hoursPerLesson) * Number(scheduledLessonCount) * 10000,
    ) / 10000
  );
}

/**
 * FEE TRIGGER (#443): while short, the fee invoices after Lesson 1 is
 * confirmed by BOTH sides — or immediately on booking confirmation when the
 * package is a single lesson (count = 1). The standard Lesson-2 trigger must
 * NOT fire while short (checked by the caller, never here).
 */
export function shouldInvoiceShortFee(input: {
  scheduledLessonCount: number;
  lesson1Status: string | null | undefined;
}): boolean {
  const count = Number(input.scheduledLessonCount);
  if (!Number.isInteger(count) || count < 1 || count > SHORT_CASE_MAX_LESSONS) return false;
  if (count === 1) return true;
  return input.lesson1Status === "confirmed" || input.lesson1Status === "done";
}

/**
 * Sum of what the tutor has ALREADY been billed on the case — invoiced (open)
 * + paid rows. Waived/refunded rows never count: no money is owed under them.
 * Mirrors derivePaidState's "paid counts" rule plus the open invoice.
 */
export type BilledFeeRow = { status: string; amount_hkd: number | string | null };

export function sumBilledFeeHkd(fees: BilledFeeRow[]): number {
  return fees.reduce((sum, f) => {
    if (f.status !== "invoiced" && f.status !== "paid") return sum;
    const n = Number(f.amount_hkd);
    return Number.isFinite(n) && n > 0 ? sum + n : sum;
  }, 0);
}

/**
 * Convert balance: the standard 1.5-lesson fee minus everything already
 * billed, floored at 0 — the desk must NEVER over-invoice. 0 renders as
 * "No balance due" and creates no case_fees row.
 */
export function convertBalanceAmountHkd(standardFeeHkd: number, billedTotalHkd: number): number {
  const standard = Number(standardFeeHkd);
  const billed = Number(billedTotalHkd);
  const std = Number.isFinite(standard) && standard > 0 ? standard : 0;
  const paid = Number.isFinite(billed) && billed > 0 ? billed : 0;
  return Math.max(0, Math.round(std - paid));
}

/**
 * The desk confirm gate: enabling the short flag REQUIRES a named
 * confirmation source and the pasted WhatsApp/CS text (min 10 chars — enough
 * to prove a real reply was pasted, short enough not to fight CS notes).
 */
export function shortCaseConfirmationError(input: {
  confirmedBy: string | null | undefined;
  confirmedNote: string | null | undefined;
}): string | null {
  if (
    input.confirmedBy === null ||
    input.confirmedBy === undefined ||
    !SHORT_CASE_CONFIRMED_BY_OPTIONS.includes(input.confirmedBy as ShortCaseConfirmedBy)
  ) {
    return "CONFIRM_SOURCE_REQUIRED";
  }
  const note = (input.confirmedNote ?? "").trim();
  if (note.length < 10) return "CONFIRM_NOTE_REQUIRED";
  return null;
}

/**
 * The case_notes body persisted with the confirmation — a fixed prefix so the
 * notes panel and future audits can grep the fee decision.
 */
export function buildShortCaseConfirmNote(
  confirmedBy: ShortCaseConfirmedBy,
  confirmedNote: string,
): string {
  return `[short-case confirm · ${confirmedBy}] ${confirmedNote.trim()}`;
}
