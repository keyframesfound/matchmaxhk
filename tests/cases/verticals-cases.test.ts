import { describe, expect, it } from "vitest";

import {
  buildVerticalInsert,
  normalizeFunnelLevel,
  storedStudentLevel,
  tierForFunnelLevel,
} from "../../src/features/cases/case-verticals";
import { KINDERGARTEN_TOPICS } from "../../src/features/tutors/verticals";

describe("normalizeFunnelLevel", () => {
  it("accepts canonical funnel levels only", () => {
    expect(normalizeFunnelLevel("Kindergarten")).toBe("Kindergarten");
    expect(normalizeFunnelLevel("University")).toBe("University");
    expect(normalizeFunnelLevel("kindergarten")).toBeNull();
    expect(normalizeFunnelLevel("Junior secondary")).toBeNull();
    expect(normalizeFunnelLevel(42)).toBeNull();
    expect(normalizeFunnelLevel(null)).toBeNull();
  });
});

describe("storedStudentLevel", () => {
  it("maps direct levels 1:1", () => {
    expect(storedStudentLevel("Kindergarten")).toBe("Kindergarten");
    expect(storedStudentLevel("Primary")).toBe("Primary");
    expect(storedStudentLevel("University")).toBe("University");
  });

  it("requires the junior/senior band for Secondary", () => {
    expect(storedStudentLevel("Secondary", "Junior secondary")).toBe("Junior secondary");
    expect(storedStudentLevel("Secondary", "Senior secondary")).toBe("Senior secondary");
    expect(storedStudentLevel("Secondary", null)).toBeNull();
    expect(storedStudentLevel("Secondary", "Middle school")).toBeNull();
  });

  it("returns null for unknown levels", () => {
    expect(storedStudentLevel(null)).toBeNull();
  });
});

describe("tierForFunnelLevel", () => {
  it("derives the academic_tier enum from the funnel answer", () => {
    expect(tierForFunnelLevel("Kindergarten")).toBe("kindergarten");
    expect(tierForFunnelLevel("University")).toBe("university");
    expect(tierForFunnelLevel("Primary")).toBe("primary_secondary");
    expect(tierForFunnelLevel("Secondary")).toBe("primary_secondary");
    expect(tierForFunnelLevel(null)).toBe("primary_secondary");
  });
});

describe("buildVerticalInsert", () => {
  it("keeps the uni block only for the university tier", () => {
    const row = buildVerticalInsert({
      academicLevel: "University",
      uniField: " Business & Management ",
      uniName: "HKU",
      uniProgram: "BBA",
      uniCourseCodes: "ECON1210 — assignment help",
      kindergartenTopics: ["Kindergarten Phonics"],
    });
    expect(row.academic_tier).toBe("university");
    expect(row.uni_field).toBe("Business & Management");
    expect(row.uni_name).toBe("HKU");
    expect(row.uni_program).toBe("BBA");
    expect(row.uni_course_codes).toBe("ECON1210 — assignment help");
    expect(row.kindergarten_focus).toEqual([]);
  });

  it("keeps normalized K topics only for the kindergarten tier", () => {
    const row = buildVerticalInsert({
      academicLevel: "Kindergarten",
      uniField: "Engineering",
      uniName: "HKUST",
      uniProgram: "BEng",
      uniCourseCodes: "COMP2011",
      kindergartenTopics: [
        "Kindergarten Phonics",
        "not a real topic",
        "Kindergarten Phonics",
        "P1 Interview, General Knowledge",
      ],
    });
    expect(row.academic_tier).toBe("kindergarten");
    expect(row.uni_field).toBeNull();
    expect(row.uni_name).toBeNull();
    expect(row.uni_program).toBeNull();
    expect(row.uni_course_codes).toBeNull();
    expect(row.kindergarten_focus).toEqual([
      "Kindergarten Phonics",
      "P1 Interview, General Knowledge",
    ]);
  });

  it("empties the vertical columns for the primary/secondary tier", () => {
    const row = buildVerticalInsert({
      academicLevel: "Secondary",
      uniField: "Law",
      kindergartenTopics: ["Kindergarten Phonics"],
    });
    expect(row.academic_tier).toBe("primary_secondary");
    expect(row.uni_field).toBeNull();
    expect(row.kindergarten_focus).toEqual([]);
  });

  it("trims blank text to null and caps long course text", () => {
    const row = buildVerticalInsert({
      academicLevel: "University",
      uniField: "   ",
      uniName: "  ",
      uniProgram: "",
      uniCourseCodes: `x`.repeat(2500),
    });
    expect(row.uni_field).toBeNull();
    expect(row.uni_name).toBeNull();
    expect(row.uni_program).toBeNull();
    expect(row.uni_course_codes).toHaveLength(2000);
  });

  it("covers every canonical K topic as valid input", () => {
    const row = buildVerticalInsert({
      academicLevel: "Kindergarten",
      kindergartenTopics: KINDERGARTEN_TOPICS,
    });
    expect(row.kindergarten_focus).toEqual([...KINDERGARTEN_TOPICS]);
  });
});
