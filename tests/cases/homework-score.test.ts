import { describe, expect, it } from "vitest";

import {
  homeworkScoreEntries,
  type HomeworkScoreRow,
} from "../../src/features/cases/case-progress";
import {
  HOMEWORK_SCORE_MAX,
  homeworkScoreError,
  isUndefinedColumn,
} from "../../src/features/cases/homework";

/** Issue #736 AC1: reviewed homework carries an optional 0-100 score. */

describe("isUndefinedColumn", () => {
  it("recognises a PostgREST undefined-column error by code", () => {
    expect(
      isUndefinedColumn({
        code: "42703",
        message: 'column "score_pct" does not exist',
      }),
    ).toBe(true);
  });

  it("recognises the wrapped message selectRows throws", () => {
    expect(
      isUndefinedColumn(
        new Error(
          'case_homework: column "score_pct" of relation "case_homework" does not exist [42703]',
        ),
      ),
    ).toBe(true);
    expect(isUndefinedColumn({ message: 'column "score_pct" does not exist' })).toBe(true);
  });

  it("does not swallow any other database error", () => {
    expect(
      isUndefinedColumn({ code: "42P01", message: 'relation "case_homework" does not exist' }),
    ).toBe(false);
    expect(isUndefinedColumn(new Error("permission denied for table case_homework"))).toBe(false);
    expect(isUndefinedColumn(null)).toBe(false);
    expect(isUndefinedColumn("42703")).toBe(false);
  });
});

describe("homeworkScoreError", () => {
  it("allows a blank score", () => {
    expect(homeworkScoreError(null)).toBeNull();
    expect(homeworkScoreError(undefined)).toBeNull();
  });

  it("accepts whole percents inside the range, including the ends", () => {
    expect(HOMEWORK_SCORE_MAX).toBe(100);
    expect(homeworkScoreError(0)).toBeNull();
    expect(homeworkScoreError(85)).toBeNull();
    expect(homeworkScoreError(100)).toBeNull();
  });

  it("rejects fractions and numbers outside 0 to 100", () => {
    expect(homeworkScoreError(-1)).toBe("BAD_SCORE");
    expect(homeworkScoreError(101)).toBe("BAD_SCORE");
    expect(homeworkScoreError(85.5)).toBe("BAD_SCORE");
    expect(homeworkScoreError(Number.NaN)).toBe("BAD_SCORE");
    expect(homeworkScoreError(Number.POSITIVE_INFINITY)).toBe("BAD_SCORE");
  });
});

function row(over: Partial<HomeworkScoreRow> = {}): HomeworkScoreRow {
  return {
    id: "h1",
    title: "Algebra sheet",
    reviewedAt: "2026-11-01T10:00:00Z",
    scorePct: 85,
    ...over,
  };
}

describe("homeworkScoreEntries", () => {
  it("maps reviewed and scored homework to a 100-mark gradebook point", () => {
    expect(homeworkScoreEntries([row()])).toEqual([
      {
        id: "homework:h1",
        name: "Algebra sheet",
        assessedOn: "2026-11-01",
        marks: 85,
        maxMarks: 100,
        createdAt: "2026-11-01T10:00:00Z",
        source: "homework",
      },
    ]);
  });

  it("drops unreviewed homework and reviews with no score", () => {
    const rows = [
      row({ id: "unreviewed", reviewedAt: null }),
      row({ id: "unscored", scorePct: null }),
      row({ id: "scored" }),
    ];
    expect(homeworkScoreEntries(rows).map((entry) => entry.id)).toEqual(["homework:scored"]);
  });

  it("dates a point on its HKT review day", () => {
    // 16:30 UTC is 00:30 the next day in Hong Kong.
    const [entry] = homeworkScoreEntries([row({ reviewedAt: "2026-11-01T16:30:00Z" })]);
    expect(entry.assessedOn).toBe("2026-11-02");
  });

  it("orders points by review time, oldest first, then by id", () => {
    const entries = homeworkScoreEntries([
      row({ id: "b", reviewedAt: "2026-11-02T10:00:00Z" }),
      row({ id: "z", reviewedAt: "2026-11-01T10:00:00Z" }),
      row({ id: "a", reviewedAt: "2026-11-01T10:00:00Z" }),
    ]);
    expect(entries.map((entry) => entry.id)).toEqual(["homework:a", "homework:z", "homework:b"]);
  });

  it("is empty with no rows", () => {
    expect(homeworkScoreEntries([])).toEqual([]);
  });
});
