import { describe, expect, it } from "vitest";

import { applyLearnerPrefill, learnerPrefill } from "../../src/features/cases/learner-prefill";

describe("#698 case request pre-fill", () => {
  it("maps an IB Y12 child to senior secondary IB with subjects", () => {
    const patch = learnerPrefill({
      source: "child",
      childId: "c1",
      name: "Lucas",
      level: "y12",
      curriculum: "IB",
      subjects: ["Physics", "Mathematics"],
    });
    expect(patch).toMatchObject({
      whoFor: "my_child",
      studentId: "c1",
      academicLevel: "Secondary",
      secondaryBand: "Senior secondary",
      curriculum: "IB",
      subject1: "Physics",
      subject2: "Mathematics",
    });
  });

  it("drops a curriculum that contradicts the level and locks single-option levels", () => {
    const patch = learnerPrefill({ source: "guest", level: "p4", curriculum: "IB", subjects: [] });
    expect(patch.academicLevel).toBe("Primary");
    expect(patch.curriculum).toBe("Primary School");
  });

  it("never overwrites a field the parent edited, but updates untouched ones", () => {
    const first = learnerPrefill({
      source: "guest",
      level: "y12",
      curriculum: "IB",
      subjects: ["Physics"],
    });
    const form = applyLearnerPrefill(
      { academicLevel: "", curriculum: "", subject1: "" },
      first,
      {},
    );
    const edited = { ...form, subject1: "Chemistry" };
    const second = learnerPrefill({
      source: "guest",
      level: "s5",
      curriculum: "DSE",
      subjects: ["Biology"],
    });
    const next = applyLearnerPrefill(edited, second, first);
    expect(next.curriculum).toBe("DSE");
    expect(next.subject1).toBe("Chemistry");
  });
});
