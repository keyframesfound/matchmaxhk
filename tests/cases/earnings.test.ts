import { describe, expect, it } from "vitest";

import {
  computeEarnings,
  earningsRange,
  parseSecondaryTier,
  type EarningsCaseInput,
  type EarningsLessonInput,
} from "../../src/features/cases/earnings";

/**
 * Issue #461 Phase A — the four earnings buckets (Realized, Pipeline,
 * Forecast, Admin fee) on the tutor dashboard. Admin follows the #536 SoT:
 * R = the case's locked hourly rate, 1.0×R on the first done lesson and the
 * rest of the tier's base on the second.
 */

const NOW = new Date("2026-10-15T04:00:00Z"); // 12:00 HKT, Thu 15 Oct
const OCTOBER = earningsRange("month", NOW);

function lesson(
  sequence: number,
  startsAt: string,
  status: string,
  durationMin = 90,
): EarningsLessonInput {
  return { id: `l${sequence}-${startsAt}`, sequence, startsAt, durationMin, status };
}

function makeCase(overrides: Partial<EarningsCaseInput> = {}): EarningsCaseInput {
  return {
    caseId: "c1",
    caseCode: "MM-001",
    studentLabel: "Anson",
    hourlyRateHkd: 600,
    studentCount: 1,
    packageType: "ongoing_1_5",
    tier: "primary",
    splitMode: "100_50",
    feeRuleId: null,
    lessons: [],
    sessionLogs: [],
    ...overrides,
  };
}

describe("computeEarnings — fee by lesson order", () => {
  it("charges 1.0×R on lesson 1, 0.5×R on lesson 2, nothing after (1.5h @ HK$600)", () => {
    // Arrange
    const c = makeCase({
      lessons: [
        lesson(1, "2026-10-01T10:00:00Z", "done"),
        lesson(2, "2026-10-08T10:00:00Z", "done"),
        lesson(3, "2026-10-12T10:00:00Z", "done"),
      ],
    });

    // Act
    const result = computeEarnings([c], OCTOBER, NOW);

    // Assert
    expect(result.cases[0].lessons.map((l) => [l.grossHkd, l.adminHkd, l.netHkd])).toEqual([
      [900, 600, 300],
      [900, 300, 600],
      [900, 0, 900],
    ]);
    expect(result.totals).toMatchObject({
      realizedHkd: 1800,
      pipelineHkd: 0,
      forecastHkd: 1800,
      adminHkd: 900,
      realizedHours: 4.5,
    });
  });

  it("does not spend lesson 1's fee on a cancelled lesson", () => {
    const c = makeCase({
      lessons: [
        lesson(1, "2026-10-01T10:00:00Z", "cancelled"),
        lesson(2, "2026-10-08T10:00:00Z", "done"),
      ],
    });
    const [only] = computeEarnings([c], OCTOBER, NOW).cases[0].lessons;
    expect(only.adminHkd).toBe(600);
  });

  it("continues the order into upcoming lessons for the pipeline", () => {
    const c = makeCase({
      lessons: [
        lesson(1, "2026-10-08T10:00:00Z", "done"),
        lesson(2, "2026-10-20T10:00:00Z", "confirmed"),
        lesson(3, "2026-10-27T10:00:00Z", "planned"),
      ],
    });
    const result = computeEarnings([c], OCTOBER, NOW);
    expect(result.totals).toMatchObject({
      realizedHkd: 300,
      pipelineHkd: 1500, // 600 net on lesson 2 + 900 on lesson 3
      forecastHkd: 1800,
      adminHkd: 900,
    });
  });

  it("ignores past lessons that were never marked done", () => {
    const c = makeCase({ lessons: [lesson(1, "2026-10-05T10:00:00Z", "planned")] });
    expect(computeEarnings([c], OCTOBER, NOW).totals.forecastHkd).toBe(0);
  });
});

describe("computeEarnings — fee models", () => {
  it("takes 20% of each lesson on a short case", () => {
    const c = makeCase({
      packageType: "short_20",
      lessons: [lesson(1, "2026-10-01T10:00:00Z", "done")],
    });
    expect(computeEarnings([c], OCTOBER, NOW).totals).toMatchObject({
      realizedHkd: 720,
      adminHkd: 180,
    });
  });

  it("charges nothing on pro-bono or post-window cases", () => {
    const done = [lesson(1, "2026-10-01T10:00:00Z", "done")];
    const proBono = makeCase({ packageType: "pro_bono", lessons: done });
    const expired = makeCase({ caseId: "c2", feeRuleId: "OWNERSHIP_EXPIRED", lessons: done });
    expect(computeEarnings([proBono, expired], OCTOBER, NOW).totals.adminHkd).toBe(0);
  });

  it("follows the centre ladder: tier 2 is 1.0×R in total", () => {
    const c = makeCase({
      tier: 2,
      lessons: [
        lesson(1, "2026-10-01T10:00:00Z", "done"),
        lesson(2, "2026-10-08T10:00:00Z", "done"),
      ],
    });
    const admins = computeEarnings([c], OCTOBER, NOW).cases[0].lessons.map((l) => l.adminHkd);
    expect(admins).toEqual([600, 0]);
  });

  it("splits 75/75 when the case opted into the A/B", () => {
    const c = makeCase({
      splitMode: "75_75",
      lessons: [
        lesson(1, "2026-10-01T10:00:00Z", "done"),
        lesson(2, "2026-10-08T10:00:00Z", "done"),
      ],
    });
    const admins = computeEarnings([c], OCTOBER, NOW).cases[0].lessons.map((l) => l.adminHkd);
    expect(admins).toEqual([450, 450]);
  });

  it("scales tuition and fee by student count", () => {
    const c = makeCase({
      studentCount: 2,
      lessons: [lesson(1, "2026-10-01T10:00:00Z", "done", 60)],
    });
    const [l] = computeEarnings([c], OCTOBER, NOW).cases[0].lessons;
    expect([l.grossHkd, l.adminHkd]).toEqual([1200, 1200]);
  });
});

describe("computeEarnings — session logs (#387)", () => {
  it("counts pending and verified logs as fee-free tuition, skips disputed ones", () => {
    const c = makeCase({
      lessons: [
        lesson(1, "2026-09-01T10:00:00Z", "done"),
        lesson(2, "2026-09-08T10:00:00Z", "done"),
      ],
      sessionLogs: [
        {
          id: "s1",
          logDate: "2026-10-02",
          startMinute: 18 * 60,
          durationMin: 60,
          status: "verified",
        },
        {
          id: "s2",
          logDate: "2026-10-09",
          startMinute: 18 * 60,
          durationMin: 60,
          status: "pending",
        },
        {
          id: "s3",
          logDate: "2026-10-10",
          startMinute: 18 * 60,
          durationMin: 60,
          status: "disputed",
        },
      ],
    });
    expect(computeEarnings([c], OCTOBER, NOW).totals).toMatchObject({
      realizedHkd: 1200,
      adminHkd: 0,
      realizedHours: 2,
    });
  });

  it("does not double count a log on the same day as a done lesson", () => {
    const c = makeCase({
      lessons: [lesson(1, "2026-10-02T10:00:00Z", "done")], // 18:00 HKT, 2 Oct
      sessionLogs: [
        {
          id: "s1",
          logDate: "2026-10-02",
          startMinute: 18 * 60,
          durationMin: 90,
          status: "verified",
        },
      ],
    });
    expect(computeEarnings([c], OCTOBER, NOW).cases[0].lessons).toHaveLength(1);
  });
});

describe("computeEarnings — range and missing data", () => {
  it("only counts lessons inside the range", () => {
    const c = makeCase({
      lessons: [
        lesson(1, "2026-09-30T10:00:00Z", "done"),
        lesson(2, "2026-10-08T10:00:00Z", "done"),
      ],
    });
    const result = computeEarnings([c], OCTOBER, NOW);
    expect(result.totals).toMatchObject({ realizedHkd: 600, adminHkd: 300 });
  });

  it("flags a case with no rate instead of pricing it at HK$0", () => {
    const c = makeCase({
      hourlyRateHkd: null,
      lessons: [lesson(1, "2026-10-01T10:00:00Z", "done")],
    });
    const result = computeEarnings([c], OCTOBER, NOW);
    expect(result.cases[0].missingRate).toBe(true);
    expect(result.totals.forecastHkd).toBe(0);
    expect(result.casesMissingRate).toBe(1);
  });

  it("returns zeros for no cases", () => {
    expect(computeEarnings([], OCTOBER, NOW).totals).toEqual({
      realizedHkd: 0,
      pipelineHkd: 0,
      forecastHkd: 0,
      adminHkd: 0,
      realizedHours: 0,
    });
  });
});

describe("earningsRange", () => {
  it("covers the HKT calendar month", () => {
    expect(OCTOBER.from.toISOString()).toBe("2026-09-30T16:00:00.000Z");
    expect(OCTOBER.to.toISOString()).toBe("2026-10-31T16:00:00.000Z");
  });

  it("covers Monday to Sunday HKT", () => {
    const week = earningsRange("week", NOW);
    expect(week.from.toISOString()).toBe("2026-10-11T16:00:00.000Z"); // Mon 12 Oct 00:00 HKT
    expect(week.to.toISOString()).toBe("2026-10-18T16:00:00.000Z");
  });
});

describe("parseSecondaryTier", () => {
  it("reads the stored secondary_tier_applied text", () => {
    expect(parseSecondaryTier("2")).toBe(2);
    expect(parseSecondaryTier("4")).toBe(4);
    expect(parseSecondaryTier("primary")).toBe("primary");
  });

  it("falls back to primary for empty or unknown values", () => {
    expect(parseSecondaryTier(null)).toBe("primary");
    expect(parseSecondaryTier("9")).toBe("primary");
  });
});
