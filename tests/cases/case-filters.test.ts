// Issue #423 ship-order step 5 — the board's advanced-filter predicate.
// Tier legacy mapping, mode "either", rate overlap, tag AND, language
// token mapping, and the URL-param parsers (absent = undefined).
import { describe, expect, it } from "vitest";

import {
  caseBoardTier,
  countCaseAdvancedFilters,
  getSelectedCaseTags,
  matchesCaseFilters,
  parseCaseBackgroundParam,
  parseCaseFeeParam,
  parseCaseGenderParam,
  parseCaseLanguageParam,
  parseCaseModeParam,
  parseCaseRateParam,
  parseCaseTagsParam,
} from "../../src/features/cases/case-filters";

const baseItem = {
  academicTier: null,
  studentLevel: "Senior secondary",
  subjects: ["Chemistry"],
  mode: "either" as const,
  packageType: "ongoing_1_5" as const,
  budgetMin: null,
  budgetMax: null,
  budgetMinHkd: null,
  budgetMaxHkd: null,
  tutorBackground: null,
  preferredGender: "any" as const,
  languageOfInstruction: null,
  senRequired: false,
  tags: ["ia review", "chemistry"],
};

describe("caseBoardTier (#423)", () => {
  it("derives kindergarten/university from student_level on legacy rows", () => {
    expect(caseBoardTier({ academicTier: null, studentLevel: "University" })).toBe("university");
    expect(caseBoardTier({ academicTier: null, studentLevel: "Kindergarten" })).toBe(
      "kindergarten",
    );
  });

  it("falls back to primary_secondary for primary/secondary/unknown levels", () => {
    expect(caseBoardTier({ academicTier: null, studentLevel: "Senior secondary" })).toBe(
      "primary_secondary",
    );
    expect(caseBoardTier({ academicTier: null, studentLevel: "Year 12" })).toBe(
      "primary_secondary",
    );
  });

  it("honours the explicit academic_tier column", () => {
    expect(caseBoardTier({ academicTier: "university", studentLevel: "Year 12" })).toBe(
      "university",
    );
  });
});

describe("matchesCaseFilters (#423)", () => {
  it("passes with no filters", () => {
    expect(matchesCaseFilters(baseItem, {})).toBe(true);
  });

  it("filters by tier using the legacy fallback", () => {
    expect(matchesCaseFilters(baseItem, { tier: "primary_secondary" })).toBe(true);
    expect(matchesCaseFilters(baseItem, { tier: "university" })).toBe(false);
  });

  it("treats a mode-either case as matching either mode filter", () => {
    expect(matchesCaseFilters(baseItem, { mode: "online" })).toBe(true);
    expect(matchesCaseFilters(baseItem, { mode: "in_person" })).toBe(true);
    expect(matchesCaseFilters({ ...baseItem, mode: "online" }, { mode: "in_person" })).toBe(false);
    expect(matchesCaseFilters({ ...baseItem, mode: "in_person" }, { mode: "online" })).toBe(false);
  });

  it("filters by package type", () => {
    expect(matchesCaseFilters(baseItem, { fee: "ongoing_1_5" })).toBe(true);
    expect(matchesCaseFilters(baseItem, { fee: "pro_bono" })).toBe(false);
  });

  it("rate filter matches overlapping budgets and drops rate-less cases", () => {
    const item = { ...baseItem, budgetMinHkd: 300, budgetMaxHkd: 500 };
    expect(matchesCaseFilters(item, { rate_min: 400 })).toBe(true);
    expect(matchesCaseFilters(item, { rate_min: 500 })).toBe(true);
    expect(matchesCaseFilters(item, { rate_min: 501 })).toBe(false);
    expect(matchesCaseFilters(item, { rate_max: 350 })).toBe(true);
    expect(matchesCaseFilters(item, { rate_max: 299 })).toBe(false);
    // No budget at all → can't satisfy a rate filter.
    expect(matchesCaseFilters(baseItem, { rate_min: 100 })).toBe(false);
  });

  it("rate filter accepts one-sided budgets", () => {
    const maxOnly = { ...baseItem, budgetMaxHkd: 500 };
    expect(matchesCaseFilters(maxOnly, { rate_min: 300 })).toBe(true);
    expect(matchesCaseFilters(maxOnly, { rate_max: 400 })).toBe(true);
    const minOnly = { ...baseItem, budgetMinHkd: 600 };
    expect(matchesCaseFilters(minOnly, { rate_min: 500 })).toBe(true);
    expect(matchesCaseFilters(minOnly, { rate_max: 500 })).toBe(false);
  });

  it("filters by tutor background and gender preference", () => {
    expect(matchesCaseFilters(baseItem, { background: "uni_student" })).toBe(false);
    expect(
      matchesCaseFilters(
        { ...baseItem, tutorBackground: "uni_student" },
        { background: "uni_student" },
      ),
    ).toBe(true);
    expect(matchesCaseFilters(baseItem, { gender: "female" })).toBe(false);
    expect(
      matchesCaseFilters({ ...baseItem, preferredGender: "female" }, { gender: "female" }),
    ).toBe(true);
  });

  it("language filter matches the stored tokens, never the no-preference token", () => {
    expect(
      matchesCaseFilters({ ...baseItem, languageOfInstruction: "en" }, { language: "english" }),
    ).toBe(true);
    expect(
      matchesCaseFilters(
        { ...baseItem, languageOfInstruction: "english_only" },
        { language: "english" },
      ),
    ).toBe(true);
    expect(
      matchesCaseFilters(
        { ...baseItem, languageOfInstruction: "zh-HK" },
        { language: "cantonese" },
      ),
    ).toBe(true);
    expect(
      matchesCaseFilters({ ...baseItem, languageOfInstruction: "either" }, { language: "english" }),
    ).toBe(false);
  });

  it("sen filter requires sen_required", () => {
    expect(matchesCaseFilters(baseItem, { sen: true })).toBe(false);
    expect(matchesCaseFilters({ ...baseItem, senRequired: true }, { sen: true })).toBe(true);
  });

  it("tags AND together and normalize spellings", () => {
    expect(matchesCaseFilters(baseItem, { tags: "ia review" })).toBe(true);
    expect(matchesCaseFilters(baseItem, { tags: "ia-review" })).toBe(true);
    expect(matchesCaseFilters(baseItem, { tags: "ia review||chemistry" })).toBe(true);
    expect(matchesCaseFilters(baseItem, { tags: "ia review||tok" })).toBe(false);
  });

  it("subjects match exactly", () => {
    expect(matchesCaseFilters(baseItem, { subject: "Chemistry" })).toBe(true);
    expect(matchesCaseFilters(baseItem, { subject: "chemistry" })).toBe(false);
  });
});

describe("URL-param parsers (#423)", () => {
  it("accept only canonical tokens and return undefined otherwise", () => {
    expect(parseCaseModeParam("online")).toBe("online");
    expect(parseCaseModeParam("either")).toBeUndefined();
    expect(parseCaseFeeParam("short_20")).toBe("short_20");
    expect(parseCaseFeeParam("monthly")).toBeUndefined();
    expect(parseCaseBackgroundParam("full_part_time_tutor")).toBeUndefined();
    expect(parseCaseGenderParam("female")).toBe("female");
    expect(parseCaseLanguageParam("english")).toBe("english");
    expect(parseCaseLanguageParam("mandarin")).toBeUndefined();
  });

  it("parses rate bounds as non-negative integers", () => {
    expect(parseCaseRateParam(300)).toBe(300);
    expect(parseCaseRateParam("300")).toBe(300);
    expect(parseCaseRateParam(-5)).toBeUndefined();
    expect(parseCaseRateParam("abc")).toBeUndefined();
    expect(parseCaseRateParam(undefined)).toBeUndefined();
  });

  it("normalizes and dedupes the multi-tag param", () => {
    expect(parseCaseTagsParam("IA-review||Chemistry||ia review")).toBe("ia review||chemistry");
    expect(parseCaseTagsParam("")).toBeUndefined();
    expect(parseCaseTagsParam(undefined)).toBeUndefined();
  });
});

describe("getSelectedCaseTags / countCaseAdvancedFilters (#423)", () => {
  it("splits the joined param", () => {
    expect(getSelectedCaseTags({ tags: "ia review||tok" })).toEqual(["ia review", "tok"]);
    expect(getSelectedCaseTags({})).toEqual([]);
  });

  it("counts only dialog filters", () => {
    expect(countCaseAdvancedFilters({})).toBe(0);
    expect(
      countCaseAdvancedFilters({
        tier: "university",
        fee: "pro_bono",
        gender: "female",
        language: "english",
        sen: true,
        rate_min: 100,
        rate_max: 200,
        tags: "ia review||tok",
        // Pill-bar filters never count:
        q: "chemistry",
        subject: "Chemistry",
        mode: "online",
      } as never),
    ).toBe(9);
  });
});
