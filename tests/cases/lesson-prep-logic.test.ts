import { describe, expect, it } from "vitest";

import {
  LESSON_PREP_NOTE_MAX,
  LESSON_TOPIC_MAX,
  canWriteLessonPrep,
  lessonStillUpcoming,
  normaliseLessonPrep,
  normaliseLessonTopic,
  normalisePrepNote,
} from "../../src/features/cases/case-manager/lesson-prep";

const NOW = new Date("2026-11-22T04:00:00.000Z");

describe("normaliseLessonTopic", () => {
  it("trims and keeps the text", () => {
    expect(normaliseLessonTopic("  Quadratic equations  ")).toBe("Quadratic equations");
  });

  it("strips a leading markdown hash and the space after it", () => {
    expect(normaliseLessonTopic("# Simultaneous equations")).toBe("Simultaneous equations");
    expect(normaliseLessonTopic("###   Trigonometry")).toBe("Trigonometry");
  });

  it("keeps a hash that is not the leading marker", () => {
    expect(normaliseLessonTopic("C# basics")).toBe("C# basics");
  });

  it("treats blank, hash-only and empty input as no topic", () => {
    expect(normaliseLessonTopic("   ")).toBeNull();
    expect(normaliseLessonTopic("#")).toBeNull();
    expect(normaliseLessonTopic("")).toBeNull();
    expect(normaliseLessonTopic(null)).toBeNull();
    expect(normaliseLessonTopic(undefined)).toBeNull();
  });

  it("accepts exactly the maximum length", () => {
    const text = "a".repeat(LESSON_TOPIC_MAX);
    expect(normaliseLessonTopic(text)).toBe(text);
  });

  it("rejects a topic past the maximum", () => {
    expect(() => normaliseLessonTopic("a".repeat(LESSON_TOPIC_MAX + 1))).toThrow("TOPIC_TOO_LONG");
  });

  it("measures the limit after the hash is stripped", () => {
    expect(normaliseLessonTopic(`# ${"a".repeat(LESSON_TOPIC_MAX)}`)).toBe(
      "a".repeat(LESSON_TOPIC_MAX),
    );
  });
});

describe("normalisePrepNote", () => {
  it("trims and keeps a leading hash as content", () => {
    expect(normalisePrepNote("  # Bring a calculator  ")).toBe("# Bring a calculator");
  });

  it("treats blank input as no note", () => {
    expect(normalisePrepNote("   ")).toBeNull();
    expect(normalisePrepNote(null)).toBeNull();
    expect(normalisePrepNote(undefined)).toBeNull();
  });

  it("caps at the note limit", () => {
    const text = "n".repeat(LESSON_PREP_NOTE_MAX);
    expect(normalisePrepNote(text)).toBe(text);
    expect(() => normalisePrepNote("n".repeat(LESSON_PREP_NOTE_MAX + 1))).toThrow("NOTE_TOO_LONG");
  });
});

describe("normaliseLessonPrep", () => {
  it("normalises both fields together", () => {
    expect(normaliseLessonPrep({ topic: " # Fractions ", note: "  Revise page 12 " })).toEqual({
      topic: "Fractions",
      note: "Revise page 12",
    });
  });

  it("leaves omitted fields as null", () => {
    expect(normaliseLessonPrep({})).toEqual({ topic: null, note: null });
    expect(normaliseLessonPrep({ topic: null, note: null })).toEqual({ topic: null, note: null });
  });
});

describe("canWriteLessonPrep", () => {
  it("lets the tutor write", () => {
    expect(canWriteLessonPrep("tutor", false)).toBe(true);
  });

  it("never lets the parent or learner write", () => {
    expect(canWriteLessonPrep("parent", false)).toBe(false);
  });

  it("lets Ops write on either side", () => {
    expect(canWriteLessonPrep("parent", true)).toBe(true);
    expect(canWriteLessonPrep("tutor", true)).toBe(true);
  });
});

describe("lessonStillUpcoming", () => {
  it("is true only for a future start", () => {
    expect(lessonStillUpcoming("2026-11-23T02:00:00.000Z", NOW)).toBe(true);
    expect(lessonStillUpcoming("2026-11-21T02:00:00.000Z", NOW)).toBe(false);
    expect(lessonStillUpcoming(NOW.toISOString(), NOW)).toBe(false);
  });

  it("treats an unparseable start as past", () => {
    expect(lessonStillUpcoming("not-a-date", NOW)).toBe(false);
  });
});
