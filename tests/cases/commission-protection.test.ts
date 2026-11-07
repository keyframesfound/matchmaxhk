import { describe, expect, it } from "vitest";

import {
  CARD_SERVICE_FEE_PCT,
  MARKETPLACE_TAKE_RATES,
  commissionCreditHkd,
  resolveChildSwitch,
  resolveLessons24Fee,
  resolveMarketplaceTakePct,
  shortTermDurationLockError,
  withCardSurcharge,
} from "../../src/features/cases/commission-protection";
import { resolveCaseFee, suggestOutcomeKind } from "../../src/features/cases/fee-drop";

describe("#672 Lessons 2–4 parent-fault fee", () => {
  const base = {
    lessonValueHkd: 600,
    studentCount: 1,
    initiator: "parent" as const,
    tutorFault: false,
  };

  it("caps the fee at 20% of completed lessons once above the 0.5-lesson floor", () => {
    // L1 + L2 done → max(0.5, 0.4) = 0.5 lesson
    expect(resolveLessons24Fee({ ...base, completedLessons: 2, daysSinceLesson1: 10 })).toMatchObject({
      adjustedFeeHkd: 300,
      multiplier: 0.5,
      ruleId: "PARENT_DROP_L2_L4",
    });
    // L1–L4 done → max(0.5, 0.8) = 0.8 lesson
    expect(resolveLessons24Fee({ ...base, completedLessons: 4, daysSinceLesson1: 20 })).toMatchObject({
      adjustedFeeHkd: 480,
      multiplier: 0.8,
    });
  });

  it("ignores the window when the stop is tutor-fault or outside 28 days", () => {
    expect(
      resolveLessons24Fee({ ...base, completedLessons: 3, daysSinceLesson1: 10, tutorFault: true })
        .ruleId,
    ).toBe("TUTOR_FAULT_VOID");
    expect(
      resolveLessons24Fee({ ...base, completedLessons: 3, daysSinceLesson1: 40 }).ruleId,
    ).toBe("IN_PROGRESS");
    expect(
      resolveLessons24Fee({
        ...base,
        completedLessons: 3,
        daysSinceLesson1: 10,
        initiator: "tutor",
      }).parentFault,
    ).toBe(false);
  });

  it("multiplies by student count for group cases", () => {
    expect(
      resolveLessons24Fee({ ...base, completedLessons: 4, daysSinceLesson1: 15, studentCount: 2 })
        .adjustedFeeHkd,
    ).toBe(960);
  });

  it("credits only the overpaid difference", () => {
    expect(commissionCreditHkd(900, 480)).toBe(420);
    expect(commissionCreditHkd(300, 480)).toBe(0);
    expect(commissionCreditHkd(0, 480)).toBe(0);
  });

  it("the engine resolves the same multiplier from the outcome kind", () => {
    const resolution = resolveCaseFee({
      lessonValueHkd: 600,
      studentCount: 1,
      outcome: { kind: "stopped_l2_l4", initiator: "parent", completedLessons: 4 },
    });
    expect(resolution.ruleId).toBe("PARENT_DROP_L2_L4");
    expect(resolution.finalCommissionDueHkd).toBe(480);
  });

  it("suggests the L2–4 stop from lesson rows when the family reported it", () => {
    const lessons = [
      { sequence: 1, status: "done" },
      { sequence: 2, status: "done" },
      { sequence: 3, status: "done" },
    ];
    expect(suggestOutcomeKind({ lessons, caseEnded: true, parentFaultL2L4: true })).toBe(
      "stopped_l2_l4",
    );
    // Without the family-stop flag the same rows stay "continued" (full fee).
    expect(suggestOutcomeKind({ lessons, caseEnded: true })).toBe("continued");
  });
});

describe("#672 child switch", () => {
  it("bills only a positive 1.5-lesson delta on an accepted switch", () => {
    expect(
      resolveChildSwitch({ tutorAccepts: true, currentLessonValueHkd: 600, nextLessonValueHkd: 600 })
        .extraFeeHkd,
    ).toBe(0);
    expect(
      resolveChildSwitch({ tutorAccepts: true, currentLessonValueHkd: 600, nextLessonValueHkd: 700 })
        .extraFeeHkd,
    ).toBe(150);
    const declined = resolveChildSwitch({
      tutorAccepts: false,
      currentLessonValueHkd: 600,
      nextLessonValueHkd: 600,
    });
    expect(declined.parentInitiatedStop).toBe(true);
  });
});

describe("#672 card surcharge and short-term lock", () => {
  it("adds 4% only on card payments", () => {
    expect(CARD_SERVICE_FEE_PCT).toBe(4);
    expect(withCardSurcharge(900, false)).toBe(900);
    expect(withCardSurcharge(900, true)).toBe(936);
  });

  it("refuses to shrink a locked short-case duration", () => {
    expect(
      shortTermDurationLockError({
        lockedDurationMin: 90,
        requestedDurationMin: 60,
        isShortTerm: true,
      }),
    ).toBe("DURATION_BELOW_LOCK");
    expect(
      shortTermDurationLockError({
        lockedDurationMin: 90,
        requestedDurationMin: 90,
        isShortTerm: true,
      }),
    ).toBeNull();
  });
});

describe("#672 marketplace take rates", () => {
  it("resolves 5 / 8 / 12 percent", () => {
    expect(MARKETPLACE_TAKE_RATES).toEqual({ verified: 5, standard: 8, course: 12 });
    expect(resolveMarketplaceTakePct({ verified: true, isCourse: false })).toBe(5);
    expect(resolveMarketplaceTakePct({ verified: false, isCourse: false })).toBe(8);
    expect(resolveMarketplaceTakePct({ verified: true, isCourse: true })).toBe(12);
  });
});
