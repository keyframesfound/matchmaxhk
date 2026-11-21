import { describe, expect, it } from "vitest";

import {
  MISTAKE_ERROR_REASONS,
  MISTAKE_IMAGE_MAX_BYTES,
  MISTAKE_STATUSES,
  canSetMistakeStatus,
  mistakeBookRevealed,
  mistakeCounts,
  mistakeDraftError,
  mistakeImageError,
  normalizeMistakeTag,
  nextMistakeStatus,
  solutionVisible,
  sortMistakes,
  type MistakeStatus,
} from "../../src/features/cases/mistake-book";

const draft = (over: Partial<Parameters<typeof mistakeDraftError>[0]> = {}) => ({
  title: "Q7 algebra",
  errorReason: "concept_gap" as const,
  questionText: "",
  questionImagePath: null as string | null,
  topicTag: null as string | null,
  ...over,
});

describe("Digital Mistake Book (#796 §2.2) — pure rules", () => {
  it("keeps the four locked error-reason pills", () => {
    expect(MISTAKE_ERROR_REASONS).toEqual([
      "concept_gap",
      "careless_mistake",
      "exam_keyword",
      "time_management",
    ]);
  });

  it("keeps the three-state lifecycle", () => {
    expect(MISTAKE_STATUSES).toEqual(["unresolved", "practiced_once", "mastered"]);
    expect(nextMistakeStatus("unresolved")).toBe("practiced_once");
    expect(nextMistakeStatus("practiced_once")).toBe("mastered");
    expect(nextMistakeStatus("mastered")).toBeNull();
  });

  it("lets learners advance but never regress; tutors and ops may correct", () => {
    expect(canSetMistakeStatus("unresolved", "practiced_once", "learner")).toBe(true);
    // A learner who has redone it may skip straight to Mastered.
    expect(canSetMistakeStatus("unresolved", "mastered", "learner")).toBe(true);
    expect(canSetMistakeStatus("mastered", "unresolved", "learner")).toBe(false);
    expect(canSetMistakeStatus("practiced_once", "unresolved", "learner")).toBe(false);
    expect(canSetMistakeStatus("mastered", "unresolved", "tutor")).toBe(true);
    expect(canSetMistakeStatus("mastered", "practiced_once", "ops")).toBe(true);
    // A no-op never errors.
    expect(canSetMistakeStatus("mastered", "mastered", "learner")).toBe(true);
  });

  it("caps every image at 5 MB and only accepts JPG / PNG / WEBP", () => {
    expect(MISTAKE_IMAGE_MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(mistakeImageError({ contentType: "image/jpeg", size: 1024 })).toBeNull();
    expect(
      mistakeImageError({ contentType: "image/png", size: MISTAKE_IMAGE_MAX_BYTES }),
    ).toBeNull();
    expect(mistakeImageError({ contentType: "image/webp", size: 10 })).toBeNull();
    // Exactly one byte over the cap is rejected (never silently raised).
    expect(
      mistakeImageError({ contentType: "image/jpeg", size: MISTAKE_IMAGE_MAX_BYTES + 1 }),
    ).toBe("IMAGE_TOO_LARGE");
    expect(mistakeImageError({ contentType: "application/pdf", size: 1024 })).toBe("IMAGE_TYPE");
    expect(mistakeImageError({ contentType: "image/gif", size: 1024 })).toBe("IMAGE_TYPE");
    expect(mistakeImageError({ contentType: "image/jpeg", size: 0 })).toBe("IMAGE_TYPE");
  });

  it("requires title, error reason and a question (text or photo)", () => {
    expect(mistakeDraftError(draft())).toBe("QUESTION_REQUIRED");
    expect(mistakeDraftError(draft({ questionText: "solve x" }))).toBeNull();
    expect(mistakeDraftError(draft({ questionImagePath: "c/1.png" }))).toBeNull();
    expect(mistakeDraftError(draft({ title: "  " }))).toBe("TITLE_REQUIRED");
    expect(mistakeDraftError(draft({ errorReason: null }))).toBe("REASON_REQUIRED");
  });

  it("normalises the syllabus #tag like the Super-Drawer does", () => {
    expect(normalizeMistakeTag("#QuadraticEquations")).toBe("QuadraticEquations");
    expect(normalizeMistakeTag("  #Quadratic Equations ")).toBe("Quadratic Equations");
    expect(normalizeMistakeTag("   ")).toBeNull();
    expect(normalizeMistakeTag(null)).toBeNull();
    expect(normalizeMistakeTag("x".repeat(61))).toBeNull();
  });

  it("derives the resolved counter from the rows", () => {
    const rows: { status: MistakeStatus }[] = [
      { status: "unresolved" },
      { status: "unresolved" },
      { status: "practiced_once" },
      { status: "mastered" },
    ];
    expect(mistakeCounts(rows)).toEqual({
      total: 4,
      unresolved: 2,
      practicedOnce: 1,
      mastered: 1,
      resolved: 1,
    });
    expect(mistakeCounts([])).toEqual({
      total: 0,
      unresolved: 0,
      practicedOnce: 0,
      mastered: 0,
      resolved: 0,
    });
  });

  it("hides solutions in revision mode until each card is revealed", () => {
    expect(solutionVisible(false, new Set(), "a")).toBe(true);
    expect(solutionVisible(true, new Set(), "a")).toBe(false);
    expect(solutionVisible(true, new Set(["a"]), "a")).toBe(true);
    expect(solutionVisible(true, new Set(["b"]), "a")).toBe(false);
  });

  it("opens the book only after lesson 1", () => {
    expect(mistakeBookRevealed(0)).toBe(false);
    expect(mistakeBookRevealed(1)).toBe(true);
    expect(mistakeBookRevealed(3)).toBe(true);
  });

  it("sorts newest first, unresolved first on a tie", () => {
    const rows = [
      { id: "a", status: "mastered" as MistakeStatus, createdAt: "2026-11-18T10:00:00.000Z" },
      { id: "b", status: "unresolved" as MistakeStatus, createdAt: "2026-11-19T10:00:00.000Z" },
      { id: "c", status: "practiced_once" as MistakeStatus, createdAt: "2026-11-19T10:00:00.000Z" },
    ];
    expect(sortMistakes(rows).map((r) => r.id)).toEqual(["b", "c", "a"]);
    // The input array is never mutated.
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});
