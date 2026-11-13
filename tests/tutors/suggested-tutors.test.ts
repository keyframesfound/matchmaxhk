import { describe, expect, it } from "vitest";

import { buildSuggestionTargets, suggestTutors } from "../../src/features/tutors/suggested-tutors";

const tutor = (id: string, subjects: string[], extra: Record<string, unknown> = {}) => ({
  id,
  subjects,
  target_students: ["Secondary"],
  card_highlights: ["IBDP 42/45"],
  ...extra,
});

describe("#716 suggested for you", () => {
  it("never targets a subject with an active match", () => {
    const targets = buildSuggestionTargets({
      interests: [{ curriculum: "IB", subjects: ["Psychology", "Economics"] }],
      excludedSubjects: ["Psychology"],
    });
    expect(targets.some((t) => t.subject === "Psychology")).toBe(false);
    expect(targets[0]).toMatchObject({ subject: "Economics", kind: "search" });
    expect(targets.some((t) => t.kind === "complementary")).toBe(true);
  });

  it("only suggests tutors who are taking students and fit a target", () => {
    const targets = buildSuggestionTargets({
      interests: [{ curriculum: "IB", subjects: ["Economics"] }],
      excludedSubjects: ["Psychology"],
    });
    const tutors = [
      tutor("psych", ["IB Psychology HL"]),
      tutor("econ-full", ["IB Economics HL"]),
      tutor("econ", ["IB Economics HL"]),
    ];
    const picks = suggestTutors(tutors, targets, (t) => t.id !== "econ-full");
    expect(picks.map((p) => p.tutor.id)).toEqual(["econ"]);
    expect(picks[0].target).toMatchObject({ subject: "Economics", kind: "search" });
  });

  it("spreads the row across subjects", () => {
    const targets = buildSuggestionTargets({
      interests: [{ curriculum: "IB", subjects: ["Economics", "Chemistry"] }],
      excludedSubjects: [],
    });
    const tutors = [
      tutor("e1", ["IB Economics HL"]),
      tutor("e2", ["IB Economics SL"]),
      tutor("c1", ["IB Chemistry HL"]),
    ];
    const ids = suggestTutors(tutors, targets, () => true, 2).map((p) => p.tutor.id);
    expect(ids).toContain("c1");
    expect(ids).toHaveLength(2);
  });

  it("is empty without any interest", () => {
    expect(buildSuggestionTargets({ interests: [], excludedSubjects: [] })).toEqual([]);
    expect(suggestTutors([tutor("x", ["IB Economics HL"])], [], () => true)).toEqual([]);
  });
});

describe("#716 level fit", () => {
  it("never suggests a primary-only tutor to a secondary IB learner", () => {
    const targets = buildSuggestionTargets({
      interests: [{ curriculum: "IB", subjects: ["Physics"], level: "Secondary" }],
      excludedSubjects: [],
    });
    const primary = {
      id: "p",
      subjects: ["Primary English", "Primary Maths"],
      target_students: ["Primary"],
      card_highlights: ["Guided students to IB 7s"],
    };
    const secondary = {
      id: "s",
      subjects: ["IB Physics HL"],
      target_students: ["Secondary"],
      card_highlights: [],
    };
    const ids = suggestTutors([primary, secondary], targets, () => true).map((p) => p.tutor.id);
    expect(ids).toEqual(["s"]);
  });
});
