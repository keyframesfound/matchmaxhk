import { describe, expect, it } from "vitest";

import {
  COACHING_COMMENT_MAX,
  COACHING_URL_MAX,
  canWriteCoachingComment,
  coachingLessonNumber,
  lessonStarted,
  normaliseCoachingComment,
  normaliseCoachingUrl,
} from "../../src/features/cases/coaching-comment";

describe("normaliseCoachingComment", () => {
  it("trims a comment and keeps it", () => {
    expect(normaliseCoachingComment("  Work on factorising  ")).toEqual({
      ok: true,
      text: "Work on factorising",
    });
  });

  it("clears on null, undefined, empty and whitespace-only input", () => {
    for (const blank of [null, undefined, "", "   \n "]) {
      expect(normaliseCoachingComment(blank)).toEqual({ ok: true, text: null });
    }
  });

  it("accepts exactly the cap and rejects one character more", () => {
    const exact = "a".repeat(COACHING_COMMENT_MAX);
    expect(normaliseCoachingComment(exact)).toEqual({ ok: true, text: exact });
    expect(normaliseCoachingComment(exact + "a")).toEqual({ ok: false, code: "TOO_LONG" });
  });

  it("counts code points, not UTF-16 units, so emoji match the database", () => {
    const emoji = "😀".repeat(COACHING_COMMENT_MAX); // 3000 UTF-16 units
    expect(normaliseCoachingComment(emoji)).toEqual({ ok: true, text: emoji });
    expect(normaliseCoachingComment("😀".repeat(COACHING_COMMENT_MAX + 1))).toEqual({
      ok: false,
      code: "TOO_LONG",
    });
  });

  it("rejects a non-string payload", () => {
    expect(normaliseCoachingComment(42)).toEqual({ ok: false, code: "TOO_LONG" });
  });
});

describe("coaching write rule", () => {
  it("lets the matched tutor and Ops write, never a learner", () => {
    expect(canWriteCoachingComment("tutor", false)).toBe(true);
    expect(canWriteCoachingComment("parent", true)).toBe(true);
    expect(canWriteCoachingComment("parent", false)).toBe(false);
  });
});

describe("lessonStarted", () => {
  const now = new Date("2026-11-22T12:00:00.000Z");

  it("is true for a past or exactly-now lesson and false for a future one", () => {
    expect(lessonStarted("2026-11-22T11:00:00.000Z", now)).toBe(true);
    expect(lessonStarted("2026-11-22T12:00:00.000Z", now)).toBe(true);
    expect(lessonStarted("2026-11-22T13:00:00.000Z", now)).toBe(false);
  });

  it("fails closed on a missing or unparseable start time", () => {
    expect(lessonStarted(null, now)).toBe(false);
    expect(lessonStarted("not-a-date", now)).toBe(false);
  });
});

describe("coachingLessonNumber", () => {
  it("uses the stored sequence when present", () => {
    const numbers = coachingLessonNumber([
      { id: "b", sequence: 7, starts_at: "2026-11-02T10:00:00.000Z" },
    ]);
    expect(numbers.get("b")).toBe(7);
  });

  it("falls back to starts_at order when sequence is null", () => {
    const numbers = coachingLessonNumber([
      { id: "late", sequence: null, starts_at: "2026-11-09T10:00:00.000Z" },
      { id: "early", sequence: null, starts_at: "2026-11-02T10:00:00.000Z" },
      { id: "middle", sequence: null, starts_at: "2026-11-05T10:00:00.000Z" },
    ]);
    expect(numbers.get("early")).toBe(1);
    expect(numbers.get("middle")).toBe(2);
    expect(numbers.get("late")).toBe(3);
  });

  it("sorts an unparseable start last and treats a non-positive sequence as missing", () => {
    const numbers = coachingLessonNumber([
      { id: "undated", sequence: null, starts_at: null },
      { id: "zero", sequence: 0, starts_at: "2026-11-02T10:00:00.000Z" },
      { id: "later", sequence: null, starts_at: "2026-11-09T10:00:00.000Z" },
    ]);
    expect(numbers.get("zero")).toBe(1);
    expect(numbers.get("later")).toBe(2);
    expect(numbers.get("undated")).toBe(3);
  });
});

describe("normaliseCoachingUrl (#785 AC-CONV-4)", () => {
  it("keeps an https link and clears on empty, whitespace or null", () => {
    expect(normaliseCoachingUrl(" https://drive.google.com/file/d/abc ")).toEqual({
      ok: true,
      url: "https://drive.google.com/file/d/abc",
    });
    for (const blank of [null, undefined, "", "   "]) {
      expect(normaliseCoachingUrl(blank)).toEqual({ ok: true, url: null });
    }
  });

  it("refuses http, non-URLs and direct-contact hosts", () => {
    for (const bad of [
      "http://example.com/notes.pdf",
      "not a url",
      "https://",
      "https://wa.me/85291234567",
      "https://t.me/someone",
      "javascript:alert(1)",
    ]) {
      expect(normaliseCoachingUrl(bad)).toEqual({ ok: false, code: "BAD_LINK" });
    }
  });

  it("caps the link at the column's 500 characters", () => {
    const base = "https://example.com/";
    const exact = base + "a".repeat(COACHING_URL_MAX - base.length);
    expect(normaliseCoachingUrl(exact)).toEqual({ ok: true, url: exact });
    expect(normaliseCoachingUrl(exact + "a")).toEqual({ ok: false, code: "BAD_LINK" });
  });

  it("rejects a non-string payload", () => {
    expect(normaliseCoachingUrl(42)).toEqual({ ok: false, code: "BAD_LINK" });
  });
});
