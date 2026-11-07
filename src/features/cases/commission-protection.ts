/**
 * Issue #672 — commission protection rules (pure, unit-testable).
 *
 * Locks implemented here (CEO 2026-11-06 product lock, urgent):
 *  1. Lessons 2–4 parent-fault drop: the 1.5-lesson fee is retroactively
 *     capped at max(0.5 lessons, 20% of completed-lesson tuition) and the
 *     overpaid difference becomes MatchMax Commission Credit (auto-applied
 *     against the tutor's next case commission). No cash payouts.
 *  2. Midway child/sibling switch: $0 extra fee when the tutor accepts the
 *     transfer to a sibling sub-profile; when the tutor declines an
 *     unagreed curriculum/level change it is a Parent-Initiated Stop and
 *     falls back to the Lessons 1–4 rules.
 *  3. Short-term (≤5 lessons) anti-gaming: the 1.5-lesson fee is locked to
 *     the agreed standard duration — shrinking Lessons 1–2 and reverting
 *     later cannot reprice the fee.
 *  4. 4% credit-card service fee on optional card checkouts for tutoring
 *     admin fees (0% on FPS / direct transfer).
 *  5. Marketplace tiered take rates: 5% verified tutor / 8% standard /
 *     12% video courses & structured bundles (72h hold unchanged).
 *
 * Money SoT stays in fee-drop.ts (#536 resolveCaseFee): this module only
 * adds the #672 rules next to it — the L2–4 multiplier mirrors the engine
 * basis (lessonValue × studentCount), so desk snapshots and credits cannot
 * drift. The child-switch delta bills the same 1.5-lesson multiplier the
 * engine uses for the standard case fee.
 */

const CHILD_SWITCH_FEE_MULTIPLIER = 1.5;

/** Lessons 2–4 window (within 28 days of Lesson 1). */
export const LESSON_24_WINDOW_LESSONS = 4;
export const LESSON_24_WINDOW_DAYS = 28;

/** Floor of the adjusted fee: the standard 50% Lesson-1 drop protection. */
export const PARENT_FAULT_MIN_MULTIPLIER = 0.5;
/** 20% of completed-lesson tuition inside the window. */
export const PARENT_FAULT_COMPLETED_PCT = 0.2;

/** Credit card service fee on optional card checkouts (0% on FPS). */
export const CARD_SERVICE_FEE_PCT = 4;

/** #672 tiered marketplace take rates (percent of gross). */
export const MARKETPLACE_TAKE_RATES = {
  verified: 5,
  standard: 8,
  course: 12,
} as const;

export type MarketplaceSellerKind = "verified" | "standard" | "course";

export function resolveMarketplaceTakePct(seller: {
  verified: boolean;
  isCourse: boolean;
}): number {
  if (seller.isCourse) return MARKETPLACE_TAKE_RATES.course;
  return seller.verified ? MARKETPLACE_TAKE_RATES.verified : MARKETPLACE_TAKE_RATES.standard;
}

export type Lessons24FeeInput = {
  /** R: standard lesson fee in HKD (hourly × agreed duration). */
  lessonValueHkd: number;
  studentCount?: number;
  /** Mutually-confirmed completed lessons inside the window (1–4). */
  completedLessons: number;
  /** Days from Lesson 1 to the stop; null = unknown (desk verifies). */
  daysSinceLesson1: number | null;
  initiator: "parent" | "centre" | "tutor" | "admin";
  /** Verified tutor fault voids the protection entirely. */
  tutorFault: boolean;
};

export type Lessons24FeeResolution = {
  /** null → inputs incomplete, desk must not invent a number. */
  adjustedFeeHkd: number | null;
  /** Credit issued to the tutor = amount already collected − adjusted fee. */
  creditHkd: number | null;
  multiplier: number;
  /** True when the initiator is the family (parent/centre) without tutor fault. */
  parentFault: boolean;
  ruleId: "PARENT_DROP_L2_L4" | "TUTOR_FAULT_VOID" | "IN_PROGRESS";
};

/**
 * Lessons 2–4 parent-fault stop. Mirrors resolveCaseFee's shape: the
 * multiplier lands on the same lessonValue × studentCount basis the desk
 * already snapshots, so the credit is exactly (collected − adjusted).
 */
export function resolveLessons24Fee(input: Lessons24FeeInput): Lessons24FeeResolution {
  const value = Number(input.lessonValueHkd);
  const count =
    Number.isInteger(input.studentCount) && (input.studentCount as number) >= 1
      ? (input.studentCount as number)
      : 1;
  const parentFault =
    (input.initiator === "parent" || input.initiator === "centre") && !input.tutorFault;
  const inWindow =
    input.completedLessons >= 2 &&
    input.completedLessons <= LESSON_24_WINDOW_LESSONS &&
    (input.daysSinceLesson1 === null || input.daysSinceLesson1 <= LESSON_24_WINDOW_DAYS);

  if (!parentFault || !inWindow || !Number.isFinite(value) || value < 0) {
    return {
      adjustedFeeHkd: null,
      creditHkd: null,
      multiplier: Number.NaN,
      parentFault,
      ruleId: input.tutorFault ? "TUTOR_FAULT_VOID" : "IN_PROGRESS",
    };
  }
  const multiplier = Math.max(
    PARENT_FAULT_MIN_MULTIPLIER,
    PARENT_FAULT_COMPLETED_PCT * input.completedLessons,
  );
  const adjustedFeeHkd = Math.round(value * count * multiplier * 100) / 100;
  return {
    adjustedFeeHkd,
    creditHkd: adjustedFeeHkd,
    multiplier,
    parentFault,
    ruleId: "PARENT_DROP_L2_L4",
  };
}

/** Credit = collected − adjusted, floored at 0 (never a cash payout). */
export function commissionCreditHkd(collectedHkd: number, adjustedFeeHkd: number): number {
  const collected = Number(collectedHkd);
  if (!Number.isFinite(collected) || collected <= 0) return 0;
  return Math.max(0, Math.round((collected - adjustedFeeHkd) * 100) / 100);
}

export type ChildSwitchInput = {
  /** Tutor agreed to continue with the sibling sub-profile. */
  tutorAccepts: boolean;
  /** Locked standard lesson fee on the current case (hourly × duration). */
  currentLessonValueHkd: number;
  /** Standard lesson fee under the sibling's terms (same basis). */
  nextLessonValueHkd: number;
};

export type ChildSwitchResolution = {
  /** $0 extra fee on an accepted switch; only a positive 1.5-lesson delta bills. */
  extraFeeHkd: number;
  /** Tutor declined an unagreed change → treat as parent-initiated stop. */
  parentInitiatedStop: boolean;
};

export function resolveChildSwitch(input: ChildSwitchInput): ChildSwitchResolution {
  if (input.tutorAccepts) {
    // Case A: transfer with $0 extra fee; only the positive delta on the
    // 1.5-lesson fee is billed when the agreed terms themselves increase.
    const delta = Number(input.nextLessonValueHkd) - Number(input.currentLessonValueHkd);
    const extraFeeHkd =
      Number.isFinite(delta) && delta > 0
        ? Math.round(delta * CHILD_SWITCH_FEE_MULTIPLIER * 100) / 100
        : 0;
    return { extraFeeHkd, parentInitiatedStop: false };
  }
  // Case B: unagreed curriculum/level/location change → parent-initiated.
  return { extraFeeHkd: 0, parentInitiatedStop: true };
}

/** 4% card service fee, 0% on FPS / direct transfer. */
export function withCardSurcharge(amountHkd: number, card: boolean): number {
  const amount = Number(amountHkd);
  if (!card || !Number.isFinite(amount) || amount <= 0) return Math.round(amount * 100) / 100;
  return Math.round(amount * (1 + CARD_SERVICE_FEE_PCT / 100) * 100) / 100;
}

/**
 * Short-term anti-gaming: the admin fee is locked to the agreed standard
 * duration at confirm. A later "shorter lesson" cannot reprice it — the
 * fee basis stays the L1 value computed from the locked duration. Returns
 * the error reason when a case tries to shrink the fee basis mid-flight.
 */
export function shortTermDurationLockError(input: {
  lockedDurationMin: number | null;
  requestedDurationMin: number;
  isShortTerm: boolean;
}): string | null {
  if (!input.isShortTerm) return null;
  if (input.lockedDurationMin == null) return null;
  if (input.requestedDurationMin < input.lockedDurationMin) return "DURATION_BELOW_LOCK";
  return null;
}
