import { describe, it, expect } from "vitest";

import {
  SEN_CATEGORY_OPTIONS,
  matchesSenFilter,
  normalizeSenCategories,
} from "../../src/features/tutors/sen";

/**
 * Issue #199 — SEN capability vocabulary + match-all filter semantics,
 * tested as pure helpers (same precedent as tests/tutors/profile-tags).
 */

describe("normalizeSenCategories", () => {
  it("keeps only known categories, deduped, in option order", () => {
    expect(
      normalizeSenCategories(["Other", "ASD", "ASD", "Nonsense", "Dyslexia/SpLD", 42, ""]),
    ).toEqual(["ASD", "Dyslexia/SpLD", "Other"]);
  });

  it("returns an empty array for non-array input", () => {
    expect(normalizeSenCategories(null)).toEqual([]);
    expect(normalizeSenCategories("ASD")).toEqual([]);
    expect(normalizeSenCategories(undefined)).toEqual([]);
  });

  it("exposes the six HK-common categories from the issue", () => {
    expect([...SEN_CATEGORY_OPTIONS]).toEqual([
      "ADHD",
      "ASD",
      "Dyslexia/SpLD",
      "Dyspraxia",
      "Speech & Language Impairment",
      "Other",
    ]);
  });
});

describe("matchesSenFilter (match-all semantics)", () => {
  const tutor = (sen_enabled: boolean, sen_categories: string[]) => ({
    sen_enabled,
    sen_categories,
  });

  it("excludes tutors without SEN enabled, even when untagged picks exist", () => {
    expect(matchesSenFilter([], tutor(false, ["ADHD"]))).toBe(false);
    expect(matchesSenFilter(["ADHD"], tutor(false, ["ADHD"]))).toBe(false);
  });

  it("matches any SEN-enabled tutor when no category is picked", () => {
    expect(matchesSenFilter([], tutor(true, []))).toBe(true);
    expect(matchesSenFilter([], tutor(true, ["ASD"]))).toBe(true);
  });

  it("matches when the tutor carries every picked category", () => {
    expect(matchesSenFilter(["ADHD"], tutor(true, ["ADHD", "ASD"]))).toBe(true);
    expect(
      matchesSenFilter(["ADHD", "Dyslexia/SpLD"], tutor(true, ["Dyslexia/SpLD", "ADHD", "Other"])),
    ).toBe(true);
  });

  it("excludes SEN-enabled tutors missing any picked category", () => {
    // A parent picking two categories wants tutors tagged with BOTH.
    expect(matchesSenFilter(["ADHD", "ASD"], tutor(true, ["ADHD"]))).toBe(false);
    expect(matchesSenFilter(["ADHD"], tutor(true, []))).toBe(false);
  });

  it("ignores unknown picked categories (tutor can never match them)", () => {
    expect(matchesSenFilter(["Gifted"], tutor(true, ["ADHD"]))).toBe(false);
  });
});
