import { describe, expect, it } from "vitest";

import {
  PERF_WEEKS,
  homeworkCompletion,
  perfFrom,
  rollingRating,
  weekStarts,
  weeklyVerifiedHours,
  type PerfHoursRow,
} from "../../src/features/cases/tutor-performance";

/** GitHub #736 AC6: 12 HKT weeks of tutor metrics. */
// 2026-11-09T02:00Z is Monday 10:00 HKT.
const NOW = new Date("2026-11-09T02:00:00Z");

function hoursAt(occurredAt: string, hours: number): PerfHoursRow {
  return { occurredAt, hours };
}

describe("weekStarts", () => {
  it("returns 12 Monday HKT week starts, oldest first, ending with the current week", () => {
    const starts = weekStarts(NOW);
    expect(starts).toHaveLength(PERF_WEEKS);
    expect(starts[0]).toBe("2026-08-24");
    expect(starts[starts.length - 1]).toBe("2026-11-09");
  });

  it("keeps a week that starts just after midnight HKT together", () => {
    // Sunday 23:59 HKT is still the week of 2 Nov; Monday 00:00 HKT is 9 Nov.
    const sundayLate = new Date("2026-11-08T15:59:00Z");
    const mondayEarly = new Date("2026-11-08T16:00:00Z");
    expect(weekStarts(sundayLate).at(-1)).toBe("2026-11-02");
    expect(weekStarts(mondayEarly).at(-1)).toBe("2026-11-09");
  });
});

describe("weeklyVerifiedHours", () => {
  it("buckets by the HKT week containing occurred_at", () => {
    const starts = weekStarts(NOW);
    const weeks = weeklyVerifiedHours(
      [
        hoursAt("2026-11-08T15:59:00Z", 1), // Sunday 23:59 HKT → week of 2 Nov
        hoursAt("2026-11-08T16:00:00Z", 2), // Monday 00:00 HKT → week of 9 Nov
      ],
      starts,
    );
    expect(weeks).toHaveLength(PERF_WEEKS);
    expect(weeks.at(-1)).toEqual({ weekStart: "2026-11-09", hours: 2 });
    expect(weeks.at(-2)).toEqual({ weekStart: "2026-11-02", hours: 1 });
  });

  it("sums a week and rounds to 1 dp", () => {
    const starts = weekStarts(NOW);
    const weeks = weeklyVerifiedHours(
      [hoursAt("2026-11-09T03:00:00Z", 0.5), hoursAt("2026-11-10T03:00:00Z", 0.25)],
      starts,
    );
    expect(weeks.at(-1)).toEqual({ weekStart: "2026-11-09", hours: 0.8 });
  });

  it("ignores rows outside the 12-week window", () => {
    const starts = weekStarts(NOW);
    const weeks = weeklyVerifiedHours([hoursAt("2026-07-01T03:00:00Z", 9)], starts);
    expect(weeks.every((week) => week.hours === 0)).toBe(true);
  });
});

describe("homeworkCompletion", () => {
  it("counts assigned vs reviewed and rounds the rate to a whole percent", () => {
    expect(
      homeworkCompletion([
        { dueAt: "2026-11-01T00:00:00Z", reviewedAt: "2026-11-02T00:00:00Z" },
        { dueAt: "2026-11-03T00:00:00Z", reviewedAt: "2026-11-04T00:00:00Z" },
        { dueAt: "2026-11-05T00:00:00Z", reviewedAt: null },
      ]),
    ).toEqual({ assigned: 3, reviewed: 2, rate: 67 });
  });

  it("returns a null rate when nothing was assigned", () => {
    expect(homeworkCompletion([])).toEqual({ assigned: 0, reviewed: 0, rate: null });
  });
});

describe("rollingRating", () => {
  it("averages visible ratings to 1 dp", () => {
    expect(
      rollingRating([
        { rating: 5, createdAt: "2026-11-01T00:00:00Z" },
        { rating: 4, createdAt: "2026-11-02T00:00:00Z" },
        { rating: 4, createdAt: "2026-11-03T00:00:00Z" },
      ]),
    ).toEqual({ average: 4.3, count: 3 });
  });

  it("returns no average and no count without reviews", () => {
    expect(rollingRating([])).toEqual({ average: null, count: 0 });
  });
});

describe("perfFrom", () => {
  it("returns 12 buckets oldest first with the 12-week total", () => {
    const perf = perfFrom(
      {
        hoursRows: [
          hoursAt("2026-09-07T03:00:00Z", 1.2),
          hoursAt("2026-11-09T03:00:00Z", 0.5),
          hoursAt("2026-11-10T03:00:00Z", 0.25),
        ],
        homeworkRows: [{ dueAt: "2026-11-01T00:00:00Z", reviewedAt: "2026-11-02T00:00:00Z" }],
        reviewRows: [{ rating: 5, createdAt: "2026-10-15T00:00:00Z" }],
      },
      NOW,
    );
    expect(perf.weeks).toHaveLength(PERF_WEEKS);
    expect(perf.weeks[0].weekStart).toBe("2026-08-24");
    expect(perf.weeks[PERF_WEEKS - 1].weekStart).toBe("2026-11-09");
    const ordered = perf.weeks.every(
      (week, i) => i === 0 || perf.weeks[i - 1].weekStart < week.weekStart,
    );
    expect(ordered).toBe(true);
    expect(perf.weeks.find((week) => week.weekStart === "2026-09-07")?.hours).toBe(1.2);
    expect(perf.weeks.at(-1)?.hours).toBe(0.8);
    expect(perf.totalHours).toBe(2);
    expect(perf.homework).toEqual({ assigned: 1, reviewed: 1, rate: 100 });
    expect(perf.rating).toEqual({ average: 5, count: 1 });
  });
});
