import { describe, expect, it } from "vitest";

import {
  autoInvoiceDecision,
  milestoneAmountHkd,
  milestonePlan,
  plannedWrites,
  renewalBadgeFor,
  shortMilestonePlan,
  standardMilestonePlan,
  type ExistingMilestone,
} from "../../src/features/cases/fee-milestones";

const STD_INPUT = {
  rateHkd: 400,
  studentCount: 1,
  sessionLengthMinutes: 60,
  declaredLessonCount: null,
  packageType: "ongoing_1_5",
};

describe("standard milestone plan (#760 Part 1)", () => {
  it("delivers L1 at one completed lesson and L2 at two", () => {
    expect(standardMilestonePlan(0)).toEqual([
      { kind: "lesson_1_100", delivered: false },
      { kind: "lesson_2_50", delivered: false },
    ]);
    expect(standardMilestonePlan(1)[0]).toEqual({ kind: "lesson_1_100", delivered: true });
    expect(standardMilestonePlan(1)[1].delivered).toBe(false);
    const atTwo = standardMilestonePlan(2);
    expect(atTwo.every((m) => m.delivered)).toBe(true);
  });

  it("keeps delivering state stable past Lesson 2 (recalc, not append)", () => {
    expect(standardMilestonePlan(5).filter((m) => m.delivered)).toHaveLength(2);
  });

  it("absent/void attendance never reaches the plan as delivered (counter stays 0)", () => {
    // The counter math (present/late +1) lives in the roster writers; the
    // plan only sees the resulting count — a voided session unwinds to 0.
    expect(
      milestonePlan({ completedCount: 0, isShortCase: false, declaredLessonCount: null }),
    ).toEqual(standardMilestonePlan(0));
  });
});

describe("short milestone plan (#760: ≤5 lessons = 20%)", () => {
  it("stamps the 20% milestone at the first completed lesson", () => {
    expect(shortMilestonePlan(4, 1)).toEqual([{ kind: "short_course_20", delivered: true }]);
    expect(shortMilestonePlan(4, 0)).toEqual([{ kind: "short_course_20", delivered: false }]);
  });

  it("ignores junk declarations (no plan without a 1–5 count)", () => {
    expect(shortMilestonePlan(null, 3)).toEqual([]);
    expect(shortMilestonePlan(6, 3)).toEqual([]);
    expect(shortMilestonePlan(0, 3)).toEqual([]);
  });
});

describe("milestonePlan source gates", () => {
  it("SELF_BROUGHT students get NO commission milestones (HK$0)", () => {
    expect(
      milestonePlan({
        completedCount: 3,
        isShortCase: false,
        declaredLessonCount: null,
        sourceTag: "self_brought",
      }),
    ).toEqual([]);
  });

  it("routes short cases to the 20% plan and others to the 1.5-lesson plan", () => {
    expect(
      milestonePlan({
        completedCount: 1,
        isShortCase: true,
        declaredLessonCount: 5,
        sourceTag: "matchmax_matched",
      }),
    ).toEqual([{ kind: "short_course_20", delivered: true }]);
    expect(
      milestonePlan({
        completedCount: 1,
        isShortCase: false,
        declaredLessonCount: null,
        sourceTag: "matchmax_matched",
      }),
    ).toEqual(standardMilestonePlan(1));
  });
});

describe("milestoneAmountHkd", () => {
  it("uses the #385 tranche helpers for the standard milestones", () => {
    expect(milestoneAmountHkd("lesson_1_100", STD_INPUT)).toBe(400);
    expect(milestoneAmountHkd("lesson_2_50", STD_INPUT)).toBe(200);
  });

  it("uses the #443 short-case math for the 20% package fee", () => {
    // 400 × 1h × 4 lessons × 20% = 320
    expect(milestoneAmountHkd("short_course_20", { ...STD_INPUT, declaredLessonCount: 4 })).toBe(
      320,
    );
  });

  it("returns null on missing inputs instead of a lying fee", () => {
    expect(milestoneAmountHkd("lesson_1_100", { ...STD_INPUT, rateHkd: null })).toBeNull();
    expect(
      milestoneAmountHkd("short_course_20", { ...STD_INPUT, sessionLengthMinutes: null }),
    ).toBeNull();
    expect(
      milestoneAmountHkd("short_course_20", { ...STD_INPUT, declaredLessonCount: 9 }),
    ).toBeNull();
  });
});

describe("renewalBadgeFor (#760 step 3)", () => {
  it("badges when remaining ≤ 1", () => {
    expect(renewalBadgeFor(8, 7)).toEqual({ remaining: 1, showBadge: true });
    expect(renewalBadgeFor(8, 8)).toEqual({ remaining: 0, showBadge: true });
    expect(renewalBadgeFor(8, 6)).toEqual({ remaining: 2, showBadge: false });
  });

  it("never goes negative and returns null without a package", () => {
    expect(renewalBadgeFor(8, 99)).toEqual({ remaining: 0, showBadge: true });
    expect(renewalBadgeFor(null, 3)).toBeNull();
    expect(renewalBadgeFor(0, 0)).toBeNull();
  });
});

describe("plannedWrites (idempotent recalc diff)", () => {
  const input = {
    ...STD_INPUT,
    declaredLessonCount: null,
    source: "roster_attendance" as const,
    nowIso: "2026-11-12T10:00:00.000Z",
  };

  it("inserts all kinds on a fresh ledger", () => {
    const writes = plannedWrites(standardMilestonePlan(2), [], input);
    expect(writes).toHaveLength(2);
    expect(writes.every((w) => w.status === "delivered")).toBe(true);
    expect(writes[0].deliveredAt).toBe(input.nowIso);
    expect(writes[0].deliveredSource).toBe("roster_attendance");
  });

  it("no-ops when the stored rows already match the plan", () => {
    const existing: ExistingMilestone[] = [
      {
        kind: "lesson_1_100",
        status: "delivered",
        amount_hkd: 400,
        delivered_source: "roster_attendance",
      },
      {
        kind: "lesson_2_50",
        status: "delivered",
        amount_hkd: 200,
        delivered_source: "roster_attendance",
      },
    ];
    expect(plannedWrites(standardMilestonePlan(2), existing, input)).toEqual([]);
  });

  it("reverts a delivered milestone to pending when a void unwinds the counter", () => {
    const existing: ExistingMilestone[] = [
      {
        kind: "lesson_1_100",
        status: "delivered",
        amount_hkd: 400,
        delivered_source: "roster_attendance",
      },
      {
        kind: "lesson_2_50",
        status: "delivered",
        amount_hkd: 200,
        delivered_source: "roster_attendance",
      },
    ];
    const writes = plannedWrites(standardMilestonePlan(1), existing, input);
    expect(writes).toEqual([
      {
        kind: "lesson_2_50",
        status: "pending",
        amountHkd: 200,
        deliveredAt: null,
        deliveredSource: null,
      },
    ]);
  });

  it("refreshes the amount snapshot when the rate changes", () => {
    const existing: ExistingMilestone[] = [
      {
        kind: "lesson_1_100",
        status: "delivered",
        amount_hkd: 400,
        delivered_source: "roster_attendance",
      },
      {
        kind: "lesson_2_50",
        status: "delivered",
        amount_hkd: 200,
        delivered_source: "roster_attendance",
      },
    ];
    const writes = plannedWrites(standardMilestonePlan(2), existing, { ...input, rateHkd: 450 });
    expect(writes).toEqual([
      {
        kind: "lesson_1_100",
        status: "delivered",
        amountHkd: 450,
        deliveredAt: input.nowIso,
        deliveredSource: "roster_attendance",
      },
      {
        kind: "lesson_2_50",
        status: "delivered",
        amountHkd: 225,
        deliveredAt: input.nowIso,
        deliveredSource: "roster_attendance",
      },
    ]);
  });
});

describe("autoInvoiceDecision (#756 accruing → payment_due, desk-first)", () => {
  it("creates the full 1.5-lesson invoice at the L2 milestone when no fee rows exist", () => {
    const d = autoInvoiceDecision({
      feeRowCount: 0,
      deliveredKinds: ["lesson_1_100", "lesson_2_50"],
      isShortCase: false,
      declaredLessonCount: null,
      packageType: "ongoing_1_5",
      rateHkd: 400,
      studentCount: 1,
      sessionLengthMinutes: 60,
    });
    expect(d).toEqual({ create: true, multiplier: 1.5, amountHkd: 600, label: "full_admin" });
  });

  it("stays accruing at L1 only", () => {
    const d = autoInvoiceDecision({
      feeRowCount: 0,
      deliveredKinds: ["lesson_1_100"],
      isShortCase: false,
      declaredLessonCount: null,
      packageType: "ongoing_1_5",
      rateHkd: 400,
      sessionLengthMinutes: 60,
    });
    expect(d).toEqual({ create: false, reason: "nothing_due" });
  });

  it("never fires once the desk invoiced anything (rows_exist wins)", () => {
    const d = autoInvoiceDecision({
      feeRowCount: 1,
      deliveredKinds: ["lesson_1_100", "lesson_2_50"],
      isShortCase: false,
      declaredLessonCount: null,
      packageType: "ongoing_1_5",
      rateHkd: 400,
      sessionLengthMinutes: 60,
    });
    expect(d).toEqual({ create: false, reason: "rows_exist" });
  });

  it("creates the short 20% invoice at the first delivered lesson", () => {
    const d = autoInvoiceDecision({
      feeRowCount: 0,
      deliveredKinds: ["short_course_20"],
      isShortCase: true,
      declaredLessonCount: 4,
      packageType: "short_20",
      rateHkd: 400,
      sessionLengthMinutes: 60,
    });
    // multiplier = 0.2 × 1h × 4 = 0.8; amount = 400 × 4h × 20% = 320
    expect(d).toEqual({ create: true, multiplier: 0.8, amountHkd: 320, label: "short_case" });
  });

  it("refuses pro-bono and rateless cases outright", () => {
    expect(
      autoInvoiceDecision({
        feeRowCount: 0,
        deliveredKinds: ["lesson_1_100", "lesson_2_50"],
        isShortCase: false,
        declaredLessonCount: null,
        packageType: "pro_bono",
        rateHkd: 400,
        sessionLengthMinutes: 60,
      }),
    ).toEqual({ create: false, reason: "pro_bono" });
    expect(
      autoInvoiceDecision({
        feeRowCount: 0,
        deliveredKinds: ["lesson_1_100", "lesson_2_50"],
        isShortCase: false,
        declaredLessonCount: null,
        packageType: "ongoing_1_5",
        rateHkd: null,
        sessionLengthMinutes: 60,
      }),
    ).toEqual({ create: false, reason: "no_rate" });
  });
});
