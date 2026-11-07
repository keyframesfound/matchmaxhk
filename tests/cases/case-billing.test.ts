import { describe, expect, it } from "vitest";

import {
  buildStatement,
  canRespondToReschedule,
  isStatementMonth,
  rescheduleLessonError,
  type StatementLesson,
} from "../../src/features/cases/case-billing";

/** Issue #654: bookkeeping only. Months and dates are HKT. */
const NOW = new Date("2026-11-07T04:00:00Z");

function lesson(over: Partial<StatementLesson> = {}): StatementLesson {
  return { id: "l", startsAt: "2026-11-10T09:00:00Z", durationMin: 90, status: "planned", ...over };
}

describe("buildStatement", () => {
  it("multiplies hours by the agreed rate and subtotals each month", () => {
    const s = buildStatement(
      [lesson({ id: "a" }), lesson({ id: "b", startsAt: "2026-11-17T09:00:00Z", durationMin: 60 })],
      { rateHkd: 350, studentCount: 1 },
      [],
    );
    expect(s.months).toHaveLength(1);
    expect(s.months[0]).toMatchObject({
      month: "2026-11",
      lessons: 2,
      hours: 2.5,
      total: 875,
      status: "unpaid",
    });
    expect(s.months[0].lines.map((l) => l.lineTotal)).toEqual([525, 350]);
    expect(s.caseTotal).toBe(875);
  });

  it("files a lesson under its HKT month across UTC month end", () => {
    // 16:30Z on 30 Nov is 00:30 on 1 Dec in Hong Kong.
    const s = buildStatement(
      [lesson({ startsAt: "2026-11-30T16:30:00Z" })],
      { rateHkd: 100, studentCount: 1 },
      [],
    );
    expect(s.months[0].month).toBe("2026-12");
  });

  it("leaves out cancelled, no-show and late-cancelled lessons", () => {
    const s = buildStatement(
      [
        lesson({ id: "x", status: "cancelled" }),
        lesson({ id: "y", status: "no_show" }),
        lesson({ id: "z", status: "late_cancel" }),
        lesson({ id: "d", status: "done" }),
      ],
      { rateHkd: 100, studentCount: 1 },
      [],
    );
    expect(s.months[0].lines.map((l) => l.id)).toEqual(["d"]);
  });

  it("scales by student count on group cases", () => {
    const s = buildStatement([lesson({ durationMin: 60 })], { rateHkd: 200, studentCount: 3 }, []);
    expect(s.caseTotal).toBe(600);
  });

  it("shows hours but no money when the case has no rate", () => {
    const s = buildStatement([lesson()], { rateHkd: null, studentCount: 1 }, []);
    expect(s.months[0]).toMatchObject({ hours: 1.5, total: null });
    expect(s.months[0].lines[0].lineTotal).toBeNull();
    expect(s.caseTotal).toBeNull();
  });

  it("sorts months newest first and carries the shared paid status", () => {
    const s = buildStatement(
      [lesson({ startsAt: "2026-10-10T09:00:00Z" }), lesson({ id: "n" })],
      { rateHkd: 100, studentCount: 1 },
      [
        {
          month: "2026-10",
          status: "paid",
          note: null,
          markedByRole: "parent",
          markedAt: "2026-10-31T01:00:00Z",
        },
      ],
    );
    expect(s.months.map((m) => m.month)).toEqual(["2026-11", "2026-10"]);
    expect(s.months[1]).toMatchObject({ status: "paid", markedByRole: "parent" });
    expect(s.months[0]).toMatchObject({ status: "unpaid", markedByRole: null });
  });

  it("avoids float drift on a line total", () => {
    const s = buildStatement([lesson({ durationMin: 45 })], { rateHkd: 333, studentCount: 1 }, []);
    expect(s.caseTotal).toBe(249.75);
  });
});

describe("rescheduleLessonError", () => {
  const base = {
    lesson: { startsAt: "2026-11-10T09:00:00Z", status: "confirmed" },
    proposedIso: "2026-11-12T09:00:00Z",
    now: NOW,
  };

  it("accepts a future live lesson moved to a new future time", () => {
    expect(rescheduleLessonError(base)).toBeNull();
  });

  it("refuses a past lesson", () => {
    expect(
      rescheduleLessonError({
        ...base,
        lesson: { ...base.lesson, startsAt: "2026-11-01T09:00:00Z" },
      }),
    ).toBe("LESSON_PAST");
  });

  it("refuses a lesson that is no longer live", () => {
    expect(
      rescheduleLessonError({ ...base, lesson: { ...base.lesson, status: "cancelled" } }),
    ).toBe("LESSON_NOT_LIVE");
  });

  it("refuses a proposal in the past or at the same time", () => {
    expect(rescheduleLessonError({ ...base, proposedIso: "2026-11-01T09:00:00Z" })).toBe("IN_PAST");
    expect(rescheduleLessonError({ ...base, proposedIso: base.lesson.startsAt })).toBe("SAME_TIME");
  });
});

describe("canRespondToReschedule", () => {
  it("lets only the other side answer a pending request", () => {
    expect(canRespondToReschedule({ status: "pending", proposerRole: "parent" }, "tutor")).toBe(
      true,
    );
    expect(canRespondToReschedule({ status: "pending", proposerRole: "parent" }, "parent")).toBe(
      false,
    );
    expect(canRespondToReschedule({ status: "accepted", proposerRole: "parent" }, "tutor")).toBe(
      false,
    );
  });
});

describe("isStatementMonth", () => {
  it("accepts YYYY-MM only", () => {
    expect(isStatementMonth("2026-11")).toBe(true);
    expect(isStatementMonth("2026-13")).toBe(false);
    expect(isStatementMonth("2026-1")).toBe(false);
  });
});
