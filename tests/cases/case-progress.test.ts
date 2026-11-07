import { describe, expect, it } from "vitest";

import {
  assessmentError,
  assessmentPct,
  chartPoints,
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
