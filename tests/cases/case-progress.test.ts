import { describe, expect, it } from "vitest";

import {
  assessmentError,
  assessmentPct,
  chartPoints,
  cumulativeHours,
  hoursAtScores,
  hoursBars,
  sortAssessments,
  summarizeProgress,
  type AssessmentScore,
} from "../../src/features/cases/case-progress";

/** Issue #653: private progress curve. Dates are HKT calendar days. */
const NOW = new Date("2026-11-07T04:00:00Z"); // 12:00 HKT on 7 Nov

function score(over: Partial<AssessmentScore> = {}): AssessmentScore {
  return {
    assessedOn: "2026-10-01",
    marks: 31,
    maxMarks: 50,
    createdAt: "2026-10-01T00:00:00Z",
    ...over,
  };
}

describe("assessmentPct", () => {
  it("normalises marks to a percentage, keeping half marks", () => {
    expect(assessmentPct(31, 50)).toBe(62);
    expect(assessmentPct(40.5, 50)).toBe(81);
    expect(assessmentPct(1, 3)).toBe(33.3);
  });
});

describe("assessmentError", () => {
  const ok = { marks: 40, maxMarks: 50, assessedOn: "2026-11-07", now: NOW };

  it("accepts a valid score dated today in HKT", () => {
    expect(assessmentError(ok)).toBeNull();
  });

  it("blocks an invalid fraction", () => {
    expect(assessmentError({ ...ok, maxMarks: 0 })).toBe("BAD_MARKS");
    expect(assessmentError({ ...ok, marks: 51 })).toBe("BAD_MARKS");
    expect(assessmentError({ ...ok, marks: -1 })).toBe("BAD_MARKS");
    expect(assessmentError({ ...ok, marks: Number.NaN })).toBe("BAD_MARKS");
  });

  it("blocks a future or malformed date", () => {
    expect(assessmentError({ ...ok, assessedOn: "2026-11-08" })).toBe("BAD_DATE");
    expect(assessmentError({ ...ok, assessedOn: "soon" })).toBe("BAD_DATE");
    expect(assessmentError({ ...ok, assessedOn: "2026-02-31" })).toBe("BAD_DATE");
  });
});

describe("sortAssessments", () => {
  it("orders by date, then by when it was logged", () => {
    const rows = sortAssessments([
      score({ assessedOn: "2026-10-05", marks: 1 }),
      score({ assessedOn: "2026-10-01", createdAt: "2026-10-02T00:00:00Z", marks: 2 }),
      score({ assessedOn: "2026-10-01", createdAt: "2026-10-01T00:00:00Z", marks: 3 }),
    ]);
    expect(rows.map((r) => r.marks)).toEqual([3, 2, 1]);
  });
});

describe("summarizeProgress", () => {
  it("is empty with no scores", () => {
    expect(summarizeProgress([], 80)).toEqual({
      baseline: null,
      latest: null,
      delta: null,
      onTarget: false,
    });
  });

  it("has no trend from a single score", () => {
    expect(summarizeProgress([score()], null)).toMatchObject({
      baseline: 62,
      latest: 62,
      delta: null,
    });
  });

  it("measures first to latest and compares to the target", () => {
    const rows = [score(), score({ assessedOn: "2026-11-01", marks: 40.5 })];
    expect(summarizeProgress(rows, 80)).toEqual({
      baseline: 62,
      latest: 81,
      delta: 19,
      onTarget: true,
    });
    expect(summarizeProgress(rows, 90).onTarget).toBe(false);
    expect(summarizeProgress(rows, null).onTarget).toBe(false);
  });

  it("reports a drop as a negative delta", () => {
    const rows = [score({ marks: 40 }), score({ assessedOn: "2026-11-01", marks: 30 })];
    expect(summarizeProgress(rows, null).delta).toBe(-20);
  });
});

describe("chartPoints", () => {
  const frame = { width: 300, height: 100 };

  it("places x by date and y by percent", () => {
    const points = chartPoints(
      [
        score({ assessedOn: "2026-10-01", marks: 0 }),
        score({ assessedOn: "2026-10-02", marks: 25 }),
        score({ assessedOn: "2026-10-11", marks: 50 }),
      ],
      frame,
    );
    expect(points.map((p) => p.y)).toEqual([100, 50, 0]);
    expect(points.map((p) => p.x)).toEqual([0, 30, 300]);
  });

  it("centres a single point or a run on one day", () => {
    expect(chartPoints([score()], frame)[0].x).toBe(150);
    const sameDay = chartPoints([score(), score()], frame);
    expect(sameDay.map((p) => p.x)).toEqual([150, 150]);
  });
});

/** Issue #736: verified hours run behind the score line, in the same time frame. */
describe("cumulativeHours", () => {
  it("sorts by date and keeps a running total for every row", () => {
    expect(
      cumulativeHours([
        { occurredOn: "2026-10-05", hours: 1.5 },
        { occurredOn: "2026-10-01", hours: 2 },
        { occurredOn: "2026-10-05", hours: 0.25 },
      ]),
    ).toEqual([
      { occurredOn: "2026-10-01", hours: 2, cumulativeHours: 2 },
      { occurredOn: "2026-10-05", hours: 1.5, cumulativeHours: 3.5 },
      { occurredOn: "2026-10-05", hours: 0.25, cumulativeHours: 3.8 },
    ]);
  });

  it("is empty with no rows", () => {
    expect(cumulativeHours([])).toEqual([]);
  });
});

describe("hoursAtScores", () => {
  const hours = cumulativeHours([
    { occurredOn: "2026-10-01", hours: 2 },
    { occurredOn: "2026-10-05", hours: 1.5 },
  ]);

  it("takes the running total as of each score, including that day's hours", () => {
    const rows = [score({ assessedOn: "2026-10-05" }), score({ assessedOn: "2026-10-01" })];
    expect(hoursAtScores(rows, hours)).toEqual([2, 3.5]);
  });

  it("is zero before the first log row", () => {
    expect(hoursAtScores([score({ assessedOn: "2026-09-30" })], hours)).toEqual([0]);
    expect(hoursAtScores([score({ assessedOn: "2026-09-30" })], [])).toEqual([0]);
  });

  it("stays aligned with the plotted score order", () => {
    const rows = [
      score({ assessedOn: "2026-10-05" }),
      score({ assessedOn: "2026-10-01" }),
      score({ assessedOn: "2026-09-01" }),
    ];
    expect(hoursAtScores(rows, hours)).toEqual([0, 2, 3.5]);
  });
});

describe("hoursBars", () => {
  const hours = cumulativeHours([
    { occurredOn: "2026-10-01", hours: 2 },
    { occurredOn: "2026-10-05", hours: 3 },
  ]);

  it("puts the latest total at 100 and earlier scores below it", () => {
    expect(
      hoursBars([score({ assessedOn: "2026-10-01" }), score({ assessedOn: "2026-10-05" })], hours),
    ).toEqual([{ pctOfMax: 40 }, { pctOfMax: 100 }]);
  });

  it("rounds a bar height to one decimal", () => {
    const third = cumulativeHours([
      { occurredOn: "2026-10-01", hours: 1 },
      { occurredOn: "2026-10-02", hours: 2 },
    ]);
    expect(hoursBars([score({ assessedOn: "2026-10-01" })], third)).toEqual([{ pctOfMax: 33.3 }]);
  });

  it("is all zero when nothing is verified", () => {
    expect(hoursBars([score()], [])).toEqual([{ pctOfMax: 0 }]);
  });
});
