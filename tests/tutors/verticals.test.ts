import { describe, it, expect } from "vitest";

import {
  ACADEMIC_TIERS,
  KINDERGARTEN_TOPICS,
  caseAcademicTier,
  isInvalidUniversityGpaText,
  matchesKindergartenFilter,
  normalizeAcademicTier,
  normalizeCourseGrades,
  normalizeKindergartenTopics,
  normalizeTargetLevels,
  normalizeUniversityCourses,
  normalizeUniversityGpa,
  normalizeUniversityYear,
  tutorTierMembership,
  universityCourseTexts,
} from "../../src/features/tutors/verticals";

/**
 * Issue #190 — Kindergarten & University verticals: vocabulary normalization
 * and tier-matching rules. The tier rule that matters most is the cold-start
 * decision (Ryan): tutors with NO tier data show under the default
 * Primary & Secondary tab, and only an exclusively-University or
 * exclusively-Kindergarten tutor stays out of it.
 */

describe("normalizeTargetLevels", () => {
  it("keeps canonical values in option order", () => {
    expect(normalizeTargetLevels(["University", "Kindergarten"])).toEqual([
      "Kindergarten",
      "University",
    ]);
  });

  it("drops unknown and blank entries", () => {
    expect(normalizeTargetLevels(["IBDP", "", "University", 42, null])).toEqual(["University"]);
  });

  it("tolerates non-arrays", () => {
    expect(normalizeTargetLevels(undefined)).toEqual([]);
    expect(normalizeTargetLevels("University")).toEqual([]);
  });
});

describe("tutorTierMembership (cold-start rule)", () => {
  it("empty target_students lands in the default Primary & Secondary tab", () => {
    expect(tutorTierMembership([])).toEqual(new Set(["primary_secondary"]));
  });

  it("legacy curriculum strings land in Primary & Secondary", () => {
    expect(tutorTierMembership(["IBDP", "IGCSE"])).toEqual(new Set(["primary_secondary"]));
    expect(tutorTierMembership(["Junior Secondary"])).toEqual(new Set(["primary_secondary"]));
  });

  it("canonical Primary/Secondary levels land in Primary & Secondary", () => {
    expect(tutorTierMembership(["Primary", "Secondary"])).toEqual(new Set(["primary_secondary"]));
  });

  it("an exclusively-University tutor stays out of Primary & Secondary", () => {
    expect(tutorTierMembership(["University"])).toEqual(new Set(["university"]));
  });

  it("an exclusively-Kindergarten tutor stays out of Primary & Secondary", () => {
    expect(tutorTierMembership(["Kindergarten"])).toEqual(new Set(["kindergarten"]));
  });

  it("mixed tutors appear in both their vertical and Primary & Secondary", () => {
    expect(tutorTierMembership(["University", "IBDP"])).toEqual(
      new Set(["university", "primary_secondary"]),
    );
    expect(tutorTierMembership(["Kindergarten", "Primary"])).toEqual(
      new Set(["kindergarten", "primary_secondary"]),
    );
  });

  it("free-text audience values keep the default bucket", () => {
    expect(tutorTierMembership(["Adult learners"])).toEqual(new Set(["primary_secondary"]));
    expect(tutorTierMembership(["Kindergarten", "Adult learners"])).toEqual(
      new Set(["kindergarten", "primary_secondary"]),
    );
  });
});

describe("kindergarten topics", () => {
  it("normalizes to canonical tags only", () => {
    expect(
      normalizeKindergartenTopics([
        "Kindergarten Phonics",
        "IBDP",
        "P1 Interview — General Knowledge",
      ]),
    ).toEqual(["Kindergarten Phonics", "P1 Interview — General Knowledge"]);
  });

  it("matches every active toggle (AND semantics)", () => {
    const subjects = [...KINDERGARTEN_TOPICS];
    expect(matchesKindergartenFilter(subjects, { phonics: true, interviewPrep: true })).toBe(true);
    expect(matchesKindergartenFilter(["Kindergarten Phonics"], { interviewPrep: true })).toBe(
      false,
    );
  });

  it("no active toggles means no filter", () => {
    expect(matchesKindergartenFilter([], {})).toBe(true);
    expect(matchesKindergartenFilter([], { phonics: false })).toBe(true);
  });
});

describe("university vertical normalization", () => {
  it("GPA bounds: 0–4.3 accepted, else null", () => {
    expect(normalizeUniversityGpa(3.85)).toBe(3.85);
    expect(normalizeUniversityGpa("4.3")).toBe(4.3);
    expect(normalizeUniversityGpa("0")).toBe(0);
    expect(normalizeUniversityGpa(4.31)).toBe(null);
    expect(normalizeUniversityGpa(-1)).toBe(null);
    expect(normalizeUniversityGpa("abc")).toBe(null);
    expect(normalizeUniversityGpa("")).toBe(null);
  });

  it("GPA rounds to 2dp", () => {
    expect(normalizeUniversityGpa(3.849)).toBe(3.85);
  });

  // Issue #395: the editor-save guard — non-blank out-of-band GPA text must
  // BLOCK the save (surfaced as verticals.editor_gpa_invalid), never silently
  // normalize to null on the way to tutors.university_gpa.
  it("isInvalidUniversityGpaText: blank passes, out-of-band text blocks", () => {
    expect(isInvalidUniversityGpaText("")).toBe(false);
    expect(isInvalidUniversityGpaText("   ")).toBe(false);
    expect(isInvalidUniversityGpaText("3.85")).toBe(false);
    expect(isInvalidUniversityGpaText("0")).toBe(false);
    expect(isInvalidUniversityGpaText("4.3")).toBe(false);
    expect(isInvalidUniversityGpaText("4.31")).toBe(true);
    expect(isInvalidUniversityGpaText("-1")).toBe(true);
    expect(isInvalidUniversityGpaText("abc")).toBe(true);
    expect(isInvalidUniversityGpaText(" 5 ")).toBe(true);
  });

  it("course tags: trim, dedupe case-insensitively, cap", () => {
    expect(normalizeUniversityCourses(["ECON1210", " econ1210 ", "", "ACCT1101"])).toEqual([
      "ECON1210",
      "ACCT1101",
    ]);
    expect(
      normalizeUniversityCourses(Array.from({ length: 20 }, (_, i) => `COURSE${i}`)).length,
    ).toBe(12);
    expect(normalizeUniversityCourses("ECON1210")).toEqual([]);
  });

  it("year of study accepts canonical values only", () => {
    expect(normalizeUniversityYear("Year 3")).toBe("Year 3");
    expect(normalizeUniversityYear("Alumni / Graduate")).toBe("Alumni / Graduate");
    expect(normalizeUniversityYear("Year 7")).toBe(null);
    expect(normalizeUniversityYear("")).toBe(null);
  });

  it("course grades: canonical grades, first wins per course", () => {
    expect(
      normalizeCourseGrades([
        { course: "ECON1210", grade: "A+" },
        { course: "econ1210", grade: "B" },
        { course: "ACCT1101", grade: "Z" },
      ]),
    ).toEqual({ ECON1210: "A+" });
  });
});

describe("academic tier", () => {
  it("normalizes stored tiers", () => {
    expect(normalizeAcademicTier("university")).toBe("university");
    expect(normalizeAcademicTier(" Kindergarten ")).toBe("kindergarten");
    expect(normalizeAcademicTier("ibdp")).toBe(null);
  });

  it("derives legacy tiers from student_level", () => {
    expect(caseAcademicTier(null, "University")).toBe("university");
    expect(caseAcademicTier(null, "Primary")).toBe(null);
    expect(caseAcademicTier("primary_secondary", "University")).toBe("primary_secondary");
  });

  it("exposes exactly the three stored tiers", () => {
    expect([...ACADEMIC_TIERS]).toEqual(["kindergarten", "primary_secondary", "university"]);
  });
});

describe("universityCourseTexts (search haystack)", () => {
  it("collects courses taught + graded course codes", () => {
    expect(
      universityCourseTexts({
        university_courses: ["ECON1210", "ACCT1101"],
        course_specific_grades: { ECON1210: "A+", MATH1010: "A" },
      }),
    ).toEqual(["ECON1210", "ACCT1101", "ECON1210", "MATH1010"]);
  });

  it("tolerates junk shapes", () => {
    expect(
      universityCourseTexts({ university_courses: "ECON1210", course_specific_grades: [] }),
    ).toEqual([]);
    expect(universityCourseTexts({})).toEqual([]);
  });
});
