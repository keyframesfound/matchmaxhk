import { describe, expect, it } from "vitest";

import {
  FIT_OPTIONS,
  MAX_FIT,
  MAX_STYLES,
  MAX_TAGS,
  STYLE_OPTIONS,
  TAG_OPTIONS,
  chipLabel,
  sanitizeChips,
  toggleChip,
} from "../../src/features/tutor-application/matching-chips";

/**
 * #798 AC-2: the chips are optional. These tests pin the two properties that
 * keep them from ever blocking a publish — an empty selection stays empty and
 * a malformed draft degrades to empty instead of throwing — plus the caps the
 * DB CHECKs mirror.
 */
describe("#798 matching chips", () => {
  describe("toggleChip", () => {
    it("adds a value when it is not selected", () => {
      expect(toggleChip([], "exam-focused", MAX_STYLES)).toEqual(["exam-focused"]);
      expect(toggleChip(["exam-focused"], "concept-first", MAX_STYLES)).toEqual([
        "exam-focused",
        "concept-first",
      ]);
    });

    it("removes a value that is already selected", () => {
      expect(toggleChip(["exam-focused", "concept-first"], "exam-focused", MAX_STYLES)).toEqual([
        "concept-first",
      ]);
    });

    it("is a no-op at the cap", () => {
      const full = STYLE_OPTIONS.slice(0, MAX_STYLES).map((option) => option.value);
      expect(toggleChip(full, STYLE_OPTIONS[MAX_STYLES].value, MAX_STYLES)).toEqual(full);
    });

    it("never mutates the input array", () => {
      const selected = ["exam-focused"];
      toggleChip(selected, "concept-first", MAX_STYLES);
      expect(selected).toEqual(["exam-focused"]);
    });
  });

  describe("sanitizeChips", () => {
    it("keeps a valid selection and dedupes it", () => {
      expect(sanitizeChips(["dse", "ib", "dse"], TAG_OPTIONS, MAX_TAGS)).toEqual(["dse", "ib"]);
    });

    it("drops unknown, blank and non-string values", () => {
      expect(
        sanitizeChips(["dse", "not-a-tag", "  ", "", 42, null], TAG_OPTIONS, MAX_TAGS),
      ).toEqual(["dse"]);
      expect(sanitizeChips(["dse "], TAG_OPTIONS, MAX_TAGS)).toEqual(["dse"]);
    });

    it("caps the result at the group maximum", () => {
      const all = TAG_OPTIONS.map((option) => option.value);
      expect(sanitizeChips(all, TAG_OPTIONS, MAX_TAGS)).toHaveLength(MAX_TAGS);
      expect(sanitizeChips(all, TAG_OPTIONS, MAX_TAGS)).toEqual(all.slice(0, MAX_TAGS));
    });

    it("treats every malformed input as an empty selection", () => {
      expect(sanitizeChips(undefined, STYLE_OPTIONS, MAX_STYLES)).toEqual([]);
      expect(sanitizeChips(null, STYLE_OPTIONS, MAX_STYLES)).toEqual([]);
      expect(sanitizeChips("exam-focused", STYLE_OPTIONS, MAX_STYLES)).toEqual([]);
      expect(sanitizeChips({ value: "exam-focused" }, STYLE_OPTIONS, MAX_STYLES)).toEqual([]);
      expect(sanitizeChips(7, FIT_OPTIONS, MAX_FIT)).toEqual([]);
    });

    it("leaves an empty selection empty", () => {
      expect(sanitizeChips([], FIT_OPTIONS, MAX_FIT)).toEqual([]);
    });
  });

  describe("chipLabel", () => {
    it("renders English and Traditional Chinese labels", () => {
      expect(chipLabel("en", STYLE_OPTIONS, "exam-focused")).toBe("Exam focused");
      expect(chipLabel("zh", STYLE_OPTIONS, "exam-focused")).toBe("應試導向");
      expect(chipLabel("en", TAG_OPTIONS, "interview-prep")).toBe("Interview prep");
      expect(chipLabel("zh", TAG_OPTIONS, "interview-prep")).toBe("面試準備");
    });

    it("falls back to the stored value for an unknown chip", () => {
      expect(chipLabel("en", STYLE_OPTIONS, "retired-option")).toBe("retired-option");
    });
  });
});
