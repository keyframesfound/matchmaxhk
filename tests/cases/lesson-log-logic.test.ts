import { describe, expect, it } from "vitest";

import {
  buildLessonLogRows,
  pulseKeyFor,
  type LessonLogLesson,
} from "../../src/features/cases/lesson-log-logic";
import type {
  DrawerLogRow,
  DrawerTopic,
  StoredPulse,
} from "../../src/features/cases/super-drawer/super-drawer-logic";

const DEFAULT_PULSE: StoredPulse = {
  punctuality: "on_time",
  focus: "attentive",
  prep_hw: "prepared",
};

/** Minimal DrawerLogRow; only id / lesson_id / topics / pulse / created_at matter. */
function log(input: {
  lessonId: string;
  id?: string;
  topics?: DrawerTopic[];
  pulse?: StoredPulse;
  recapStatus?: "incomplete" | "complete";
  createdAt?: string;
}): DrawerLogRow {
  const createdAt = input.createdAt ?? "2026-11-01T10:00:00.000Z";
  return {
    id: input.id ?? `log-${input.lessonId}`,
    case_id: "case-1",
    lesson_id: input.lessonId,
    logged_by: "tutor-1",
    recap_status: input.recapStatus ?? "complete",
    topics: input.topics ?? [],
    pulse: input.pulse ?? DEFAULT_PULSE,
    recap: null,
    next_lesson_at: null,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

function lesson(
  id: string,
  sequence: number | null,
  startsAt: string,
  durationMin = 60,
): LessonLogLesson {
  return { id, sequence, starts_at: startsAt, duration_min: durationMin };
}

const topic = (tag: string): DrawerTopic => ({ tag, mastery: "practicing" });

describe("Lesson Log timeline (#796 §2.5) — pure rules", () => {
  it("labels the entry from the lesson sequence and carries its date and length", () => {
    const rows = buildLessonLogRows(
      [log({ lessonId: "lesson-a", topics: [topic("Algebra")] })],
      [lesson("lesson-a", 7, "2026-11-20T10:00:00.000Z", 90)],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      lessonId: "lesson-a",
      lessonNumber: 7,
      startsAt: "2026-11-20T10:00:00.000Z",
      durationMin: 90,
      hoursOnly: false,
    });
    expect(rows[0].topics.map((t) => t.tag)).toEqual(["Algebra"]);
  });

  it("falls back to the starts_at position when sequence is missing", () => {
    const rows = buildLessonLogRows(
      [log({ lessonId: "third" }), log({ lessonId: "first" }), log({ lessonId: "second" })],
      [
        // Deliberately out of order: position comes from starts_at, not input order.
        lesson("third", null, "2026-11-22T10:00:00.000Z"),
        lesson("first", null, "2026-11-08T10:00:00.000Z"),
        lesson("second", null, "2026-11-15T10:00:00.000Z"),
      ],
    );

    const byLesson = new Map(rows.map((row) => [row.lessonId, row.lessonNumber]));
    expect(byLesson.get("first")).toBe(1);
    expect(byLesson.get("second")).toBe(2);
    expect(byLesson.get("third")).toBe(3);
  });

  it("keeps the starts_at fallback numbered across lessons that already have a sequence", () => {
    const rows = buildLessonLogRows(
      [log({ lessonId: "unnumbered" })],
      [
        lesson("numbered-1", 1, "2026-11-08T10:00:00.000Z"),
        lesson("unnumbered", null, "2026-11-15T10:00:00.000Z"),
        lesson("numbered-3", 3, "2026-11-22T10:00:00.000Z"),
      ],
    );

    expect(rows[0].lessonNumber).toBe(2);
  });

  it("detects hours-only from empty topics, never from recap_status", () => {
    const rows = buildLessonLogRows(
      [
        // A full sync with no tag also lands 'incomplete'… and is hours-only.
        log({ lessonId: "empty", topics: [], recapStatus: "incomplete" }),
        // …and a status of 'complete' with no topics is still hours-only.
        log({ lessonId: "empty-complete", topics: [], recapStatus: "complete" }),
        // An incomplete log that DOES carry a tag is not hours-only.
        log({ lessonId: "tagged", topics: [topic("Vectors")], recapStatus: "incomplete" }),
      ],
      [
        lesson("empty", 1, "2026-11-08T10:00:00.000Z"),
        lesson("empty-complete", 2, "2026-11-15T10:00:00.000Z"),
        lesson("tagged", 3, "2026-11-22T10:00:00.000Z"),
      ],
    );

    const byLesson = new Map(rows.map((row) => [row.lessonId, row]));
    expect(byLesson.get("empty")?.hoursOnly).toBe(true);
    expect(byLesson.get("empty-complete")?.hoursOnly).toBe(true);
    expect(byLesson.get("tagged")?.hoursOnly).toBe(false);
  });

  it("treats malformed topics as hours-only rather than inventing a tag", () => {
    const malformed = log({ lessonId: "lesson-a" });
    (malformed as unknown as { topics: unknown }).topics = [{ tag: "  " }, 7];
    const rows = buildLessonLogRows([malformed], [lesson("lesson-a", 1, "2026-11-08T10:00:00Z")]);
    expect(rows[0].topics).toEqual([]);
    expect(rows[0].hoursOnly).toBe(true);
  });

  it("orders newest lesson first and never re-orders into the future", () => {
    const rows = buildLessonLogRows(
      [
        log({ lessonId: "mid", createdAt: "2026-11-16T10:00:00.000Z" }),
        log({ lessonId: "newest", createdAt: "2026-11-23T10:00:00.000Z" }),
        log({ lessonId: "oldest", createdAt: "2026-11-09T10:00:00.000Z" }),
      ],
      [
        lesson("mid", 2, "2026-11-15T10:00:00.000Z"),
        lesson("oldest", 1, "2026-11-08T10:00:00.000Z"),
        lesson("newest", 3, "2026-11-22T10:00:00.000Z"),
      ],
    );

    expect(rows.map((row) => row.lessonId)).toEqual(["newest", "mid", "oldest"]);
  });

  it("drops a log whose lesson row is missing instead of fabricating a date", () => {
    const rows = buildLessonLogRows(
      [
        log({ lessonId: "orphan", createdAt: "2026-11-25T10:00:00.000Z" }),
        log({ lessonId: "kept" }),
      ],
      [lesson("kept", 1, "2026-11-08T10:00:00.000Z")],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].lessonId).toBe("kept");
  });

  it("maps all nine pulse values to their super_drawer keys", () => {
    expect([
      pulseKeyFor("on_time"),
      pulseKeyFor("late"),
      pulseKeyFor("attentive"),
      pulseKeyFor("good"),
      pulseKeyFor("distracted"),
      pulseKeyFor("prepared"),
      pulseKeyFor("partial"),
      pulseKeyFor("none"),
    ]).toEqual([
      "super_drawer.pulse_on_time",
      "super_drawer.pulse_late",
      "super_drawer.pulse_attentive",
      "super_drawer.pulse_good",
      "super_drawer.pulse_distracted",
      "super_drawer.pulse_prepared",
      "super_drawer.pulse_partial",
      "super_drawer.pulse_none",
    ]);
    expect(pulseKeyFor("excellent")).toBeNull();
    expect(pulseKeyFor("")).toBeNull();
    expect(pulseKeyFor(" ON_TIME ")).toBe("super_drawer.pulse_on_time");
  });

  it("keeps pulse keys in punctuality → focus → prep order and drops unknowns", () => {
    const rows = buildLessonLogRows(
      [
        log({
          lessonId: "lesson-a",
          topics: [topic("Algebra")],
          pulse: { punctuality: "late", focus: "distracted", prep_hw: "none" },
        }),
      ],
      [lesson("lesson-a", 1, "2026-11-08T10:00:00.000Z")],
    );

    expect(rows[0].pulseKeys).toEqual([
      "super_drawer.pulse_late",
      "super_drawer.pulse_distracted",
      "super_drawer.pulse_none",
    ]);
  });

  it("clears the pulse on an hours-only entry, which was never an assessment", () => {
    const rows = buildLessonLogRows(
      [log({ lessonId: "hours-only", topics: [], pulse: DEFAULT_PULSE })],
      [lesson("hours-only", 3, "2026-11-22T10:00:00.000Z")],
    );

    expect(rows[0].hoursOnly).toBe(true);
    expect(rows[0].pulseKeys).toEqual([]);
  });

  it("skips missing pulse values without reordering the rest", () => {
    const rows = buildLessonLogRows(
      [
        log({
          lessonId: "no-punctuality",
          topics: [topic("Algebra")],
          pulse: { focus: "good", prep_hw: "partial" },
        }),
        log({
          lessonId: "unknown-prep",
          topics: [topic("Algebra")],
          pulse: { punctuality: "on_time", focus: "attentive", prep_hw: "homework" },
        }),
      ],
      [
        lesson("no-punctuality", 1, "2026-11-08T10:00:00.000Z"),
        lesson("unknown-prep", 2, "2026-11-15T10:00:00.000Z"),
      ],
    );

    const byLesson = new Map(rows.map((row) => [row.lessonId, row.pulseKeys]));
    expect(byLesson.get("no-punctuality")).toEqual([
      "super_drawer.pulse_good",
      "super_drawer.pulse_partial",
    ]);
    expect(byLesson.get("unknown-prep")).toEqual([
      "super_drawer.pulse_on_time",
      "super_drawer.pulse_attentive",
    ]);
  });

  it("returns an empty feed rather than a placeholder when nothing is logged", () => {
    expect(buildLessonLogRows([], [])).toEqual([]);
  });
});
