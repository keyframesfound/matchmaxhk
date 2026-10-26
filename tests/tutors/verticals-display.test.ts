import { describe, expect, it } from "vitest";

import {
  courseGradeRows,
  courseGradeRowsToRecord,
  dedupeCapStrings,
  formatCourseGradeLine,
  kindergartenTopicsInSubjects,
  selectedTargetLevels,
  toggleKindergartenTopic,
  toggleTargetLevel,
} from "../../src/features/tutors/verticals-form";
import { normalizeCourseGrades, normalizeUniversityGpa } from "../../src/features/tutors/verticals";

/**
 * Issue #190 — display/editing helpers for the Kindergarten & University
 * verticals: canonical target_students merge, K-topic tags inside subjects,
 * and course-grade pair formatting for the public profile.
 */

describe("toggleTargetLevel (merge canonical levels into target_students)", () => {
  it("adds a canonical level while preserving non-canonical strings like IBDP", () => {
    const next = toggleTargetLevel(["IBDP", "HKDSE"], "University", true);
    expect(next).toContain("IBDP");
    expect(next).toContain("HKDSE");
    expect(next).toContain("University");
    expect(next).toHaveLength(3);
  });

  it("removes only the canonical level it unticks", () => {
    const next = toggleTargetLevel(["Kindergarten", "IBDP", "Primary"], "Kindergarten", false);
    expect(next).toEqual(["IBDP", "Primary"]);
  });

  it("is case-insensitive on both add and remove", () => {
    // A legacy lowercase variant collapses into the canonical value.
    expect(toggleTargetLevel(["university"], "University", true)).toEqual(["University"]);
    expect(toggleTargetLevel(["UNIVERSITY", "IBDP"], "University", false)).toEqual(["IBDP"]);
  });

  it("dedupes other entries case-insensitively (first spelling wins)", () => {
    const next = toggleTargetLevel(["IBDP", "ibdp"], "Primary", true);
    expect(next.filter((value) => value.toLowerCase() === "ibdp")).toEqual(["IBDP"]);
  });

  it("caps the merged list at 10 values", () => {
    const existing = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10"];
    const next = toggleTargetLevel(existing, "University", true);
    expect(next).toHaveLength(10);
    expect(next).not.toContain("University");
  });
});

describe("selectedTargetLevels", () => {
  it("reads canonical levels in option order", () => {
    expect(selectedTargetLevels(["University", "Kindergarten", "IBDP"])).toEqual([
      "Kindergarten",
      "University",
    ]);
  });

  it("ignores unknown and non-canonical values", () => {
    expect(selectedTargetLevels(["ibdp", "Junior Secondary", "Adult learners"])).toEqual([]);
  });
});

describe("toggleKindergartenTopic (K topics live inside subjects)", () => {
  it("adds the canonical tag without disturbing other subjects", () => {
    const next = toggleKindergartenTopic(["IB Biology"], "Kindergarten Phonics", true);
    expect(next).toEqual(["IB Biology", "Kindergarten Phonics"]);
  });

  it("removes case-insensitively", () => {
    const next = toggleKindergartenTopic(
      ["kindergarten phonics", "IB Biology"],
      "Kindergarten Phonics",
      false,
    );
    expect(next).toEqual(["IB Biology"]);
  });

  it("does not duplicate when already present", () => {
    const next = toggleKindergartenTopic(["Kindergarten Phonics"], "Kindergarten Phonics", true);
    expect(next).toEqual(["Kindergarten Phonics"]);
  });
});

describe("kindergartenTopicsInSubjects", () => {
  it("returns canonical topics in option order", () => {
    const topics = kindergartenTopicsInSubjects([
      "P1 Interview, General Knowledge",
      "Kindergarten Phonics",
      "IB Biology",
    ]);
    expect(topics[0]).toBe("Kindergarten Phonics");
    expect(topics[1]).toBe("P1 Interview, General Knowledge");
    expect(topics).toHaveLength(2);
  });

  it("ignores non-canonical subject entries", () => {
    expect(kindergartenTopicsInSubjects(["Phonics", "Playgroup"])).toEqual([]);
  });
});

describe("course grade pairs", () => {
  it("round-trips a stored course_specific_grades object through draft rows", () => {
    const grades = normalizeCourseGrades([
      { course: "ECON1210", grade: "A+" },
      { course: "MATH1010", grade: "B" },
    ]);
    const rows = courseGradeRows(grades);
    expect(courseGradeRowsToRecord(rows)).toEqual(grades);
  });

  it("formats the public profile line as 'CODE, GRADE'", () => {
    expect(formatCourseGradeLine({ course: "ECON1210", grade: "A+" })).toBe("ECON1210, A+");
  });

  it("drops blank or half-filled rows when converting back", () => {
    expect(
      courseGradeRowsToRecord([
        { course: "ECON1210", grade: "A+" },
        { course: "", grade: "A" },
        { course: "MATH1010", grade: "" },
      ]),
    ).toEqual({ ECON1210: "A+" });
  });

  it("dedupes case-insensitively keeping the first spelling", () => {
    expect(
      courseGradeRowsToRecord([
        { course: "econ1210", grade: "B+" },
        { course: "ECON1210", grade: "A" },
      ]),
    ).toEqual({ econ1210: "B+" });
  });
});

describe("dedupeCapStrings", () => {
  it("trims, drops blanks and non-strings, dedupes case-insensitively", () => {
    expect(dedupeCapStrings([" IBDP ", "", "ibdp", 7 as unknown as string], 10)).toEqual(["IBDP"]);
  });

  it("caps at the requested size", () => {
    expect(dedupeCapStrings(["a", "b", "c"], 2)).toEqual(["a", "b"]);
  });
});

describe("normalizeUniversityGpa (payload guard rails)", () => {
  it("accepts decimals inside 0–4.3 and rounds to 2dp", () => {
    expect(normalizeUniversityGpa("3.856")).toBe(3.86);
    expect(normalizeUniversityGpa(4.3)).toBe(4.3);
  });

  it("rejects out-of-band and junk input, blank passes as null", () => {
    expect(normalizeUniversityGpa("4.31")).toBeNull();
    expect(normalizeUniversityGpa("-1")).toBeNull();
    expect(normalizeUniversityGpa("abc")).toBeNull();
    expect(normalizeUniversityGpa("")).toBeNull();
  });
});
