/**
 * #796 §2.7 — Study Plan chip groups + the tutor brief's lesson counter.
 * Pure half only: the server fn's read-through is typechecked, not unit-tested.
 */

import { describe, expect, it } from "vitest";

import {
  BOTTLENECKS,
  PREFERRED_STYLES,
  PRIMARY_GOALS,
  demandSideAccess,
  emptyDemandSide,
  sanitizeBottleneck,
  sanitizeDemandSide,
  sanitizePreferredStyle,
  sanitizeTargetExam,
  sanitizeTargetExamDate,
} from "../../src/features/cases/demand-side/demand-side";
import { completedLessonCount } from "../../src/features/cases/rating-window";

describe("widened goal list (#796)", () => {
  it("keeps the original three first and appends the two new goals", () => {
    expect(PRIMARY_GOALS).toEqual([
      "exam_boost",
      "foundation",
      "homework",
      "top_grade",
      "coursework",
    ]);
  });

  it.each([...PRIMARY_GOALS])("accepts %s through the sanitiser", (goal) => {
    expect(sanitizeDemandSide({ ...emptyDemandSide(), primaryGoal: goal }).primaryGoal).toBe(goal);
  });
});

describe("chip groups (#796)", () => {
  it("lists the locked bottleneck and preferred-style chips", () => {
    expect(BOTTLENECKS).toEqual([
      "weak_concepts",
      "careless_mistakes",
      "slow_exam_speed",
      "exam_technique",
    ]);
    expect(PREFERRED_STYLES).toEqual(["patient_step_by_step", "fast_paced", "past_paper_focused"]);
  });

  it.each([...BOTTLENECKS])("keeps the listed bottleneck %s", (value) => {
    expect(sanitizeBottleneck(value)).toBe(value);
  });

  it.each([...PREFERRED_STYLES])("keeps the listed preferred style %s", (value) => {
    expect(sanitizePreferredStyle(value)).toBe(value);
  });

  it("normalises an unknown chip to skip (null), never empty string", () => {
    const clean = sanitizeDemandSide({
      ...emptyDemandSide(),
      bottleneck: "nonsense",
      preferredStyle: "lecture_only",
    });
    expect(clean.bottleneck).toBeNull();
    expect(clean.preferredStyle).toBeNull();
    expect(sanitizeBottleneck("")).toBeNull();
    expect(sanitizePreferredStyle(undefined)).toBeNull();
  });

  it("every chip field is nullable so a skip writes a real null", () => {
    const clean = sanitizeDemandSide({
      ...emptyDemandSide(),
      bottleneck: null,
      preferredStyle: null,
    });
    expect(clean.bottleneck).toBeNull();
    expect(clean.preferredStyle).toBeNull();
    expect(clean.targetExam).toBe("");
    expect(clean.targetExamDate).toBeNull();
  });
});

describe("target exam (#796)", () => {
  it("trims and caps the free text at 80 characters", () => {
    expect(sanitizeTargetExam("  IELTS Academic  ")).toBe("IELTS Academic");
    expect(sanitizeTargetExam("x".repeat(200))).toHaveLength(80);
    expect(sanitizeTargetExam(null)).toBe("");
  });

  it("accepts only a real YYYY-MM-DD day", () => {
    expect(sanitizeTargetExamDate("2026-08-15")).toBe("2026-08-15");
    expect(sanitizeTargetExamDate(" 2026-08-15 ")).toBe("2026-08-15");
  });

  it.each([
    ["", null],
    ["2026-02-31", null],
    ["2026-13-01", null],
    ["15/08/2026", null],
    ["2026-8-15", null],
    ["next summer", null],
    [20260815, null],
    [null, null],
  ])("rejects junk %s", (raw, expected) => {
    expect(sanitizeTargetExamDate(raw)).toBe(expected);
  });
});

describe("emptyDemandSide (#796)", () => {
  it("carries every new study-plan field empty", () => {
    const empty = emptyDemandSide();
    expect(empty.bottleneck).toBeNull();
    expect(empty.preferredStyle).toBeNull();
    expect(empty.targetExam).toBe("");
    expect(empty.targetExamDate).toBeNull();
  });
});

describe("tutor brief access (#796)", () => {
  const parties = { parentId: "p", studentOwnerId: "s", tutorUserId: "t" };

  it("gives the matched tutor read and the parent edit", () => {
    expect(demandSideAccess({ userId: "t", isAdmin: false, ...parties })).toBe("read");
    expect(demandSideAccess({ userId: "p", isAdmin: false, ...parties })).toBe("edit");
    expect(demandSideAccess({ userId: "stranger", isAdmin: false, ...parties })).toBeNull();
  });

  it("counts only completed lessons, so the brief collapses after the first", () => {
    const lessons = [
      { status: "planned", confirmed_by_parent_at: null, confirmed_by_tutor_at: null },
      { status: "done", confirmed_by_parent_at: null, confirmed_by_tutor_at: null },
      { status: "confirmed", confirmed_by_parent_at: null, confirmed_by_tutor_at: null },
      {
        status: "confirmed",
        confirmed_by_parent_at: "2026-11-01T00:00:00Z",
        confirmed_by_tutor_at: "2026-11-01T00:00:00Z",
      },
    ];
    expect(completedLessonCount(lessons)).toBe(2);
    expect(completedLessonCount([])).toBe(0);
  });
});
