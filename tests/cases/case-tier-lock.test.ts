// Issue #423 bug 3 — tier/curriculum lock. A Primary case must never select
// IBDP Chemistry HL, so getCurriculumOptionsForLevel narrows the picker and
// enforceCaseTierConsistency DROPs (never rejects) inconsistent submits.
import { describe, expect, it } from "vitest";

import {
  CURRICULA_FOR_ACADEMIC_LEVEL,
  enforceCaseTierConsistency,
  getCurriculumOptionsForLevel,
} from "../../src/features/cases/case-options";

describe("getCurriculumOptionsForLevel (#423)", () => {
  it("Primary offers only Primary School — never IBDP", () => {
    const values = getCurriculumOptionsForLevel("Primary").map((o) => o.value);
    expect(values).toEqual(["Primary School"]);
  });

  it("Secondary offers the exam curricula", () => {
    const values = getCurriculumOptionsForLevel("Secondary").map((o) => o.value);
    expect(values).toEqual(["IB", "DSE", "A-Level", "IGCSE", "Junior Secondary"]);
  });

  it("Kindergarten and University lock to their single curriculum", () => {
    expect(getCurriculumOptionsForLevel("Kindergarten").map((o) => o.value)).toEqual([
      "Kindergarten",
    ]);
    expect(getCurriculumOptionsForLevel("University").map((o) => o.value)).toEqual(["University"]);
  });

  it("an unknown level leaves all options (admissions umbrella included)", () => {
    const values = getCurriculumOptionsForLevel(null).map((o) => o.value);
    expect(values).toContain("Admissions");
    expect(values.length).toBeGreaterThan(5);
  });
});

describe("enforceCaseTierConsistency (#423)", () => {
  it("drops a Primary + IB pairing and the subjects from the IB pool", () => {
    const result = enforceCaseTierConsistency({
      supportType: "subject_tutoring",
      academicLevel: "Primary",
      curriculum: "IB",
      subjects: ["Chem HL", "Recorder"],
    });
    expect(result.curriculum).toBeNull();
    // "Chem HL" is in the IB subject pool and dies with it; the custom
    // free-text subject survives.
    expect(result.subjects).toEqual(["Recorder"]);
  });

  it("keeps a coherent tier + curriculum pairing untouched", () => {
    const result = enforceCaseTierConsistency({
      supportType: "subject_tutoring",
      academicLevel: "Secondary",
      curriculum: "IB",
      subjects: ["Chem HL"],
    });
    expect(result).toEqual({ curriculum: "IB", subjects: ["Chem HL"] });
  });

  it("keeps custom (free-text) subjects when dropping a mismatched curriculum", () => {
    const result = enforceCaseTierConsistency({
      supportType: "subject_tutoring",
      academicLevel: "Primary",
      curriculum: "DSE",
      subjects: ["Chess Club", "Physics"],
    });
    expect(result.curriculum).toBeNull();
    // "Physics" is in the DSE pool; "Chess Club" is parent free text.
    expect(result.subjects).toEqual(["Chess Club"]);
  });

  it("never throws on unknown levels or empty input", () => {
    expect(
      enforceCaseTierConsistency({
        supportType: "subject_tutoring",
        academicLevel: "Adult",
        curriculum: "IB",
        subjects: [],
      }),
    ).toEqual({ curriculum: "IB", subjects: [] });
  });

  it("locks the admissions path to the admissions umbrella", () => {
    expect(
      enforceCaseTierConsistency({
        supportType: "admissions",
        academicLevel: "University",
        curriculum: "IB",
        subjects: ["IELTS"],
      }),
    ).toEqual({ curriculum: "Admissions", subjects: ["IELTS"] });
  });

  it("covers every funnel level in the mapping", () => {
    for (const level of ["Kindergarten", "Primary", "Secondary", "University"]) {
      expect(CURRICULA_FOR_ACADEMIC_LEVEL[level].length).toBeGreaterThan(0);
    }
  });
});
