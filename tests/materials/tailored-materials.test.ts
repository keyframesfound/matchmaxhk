import { describe, expect, it } from "vitest";

import { splitTailored } from "../../src/features/materials/tailored-materials";

const notes = [
  { id: "a", curriculum_tag: "HKDSE", subject_tag: "Chemistry" },
  { id: "b", curriculum_tag: "IBDP", subject_tag: "Chemistry" },
  { id: "c", curriculum_tag: "IB", subject_tag: "Physics" },
  { id: "d", curriculum_tag: "IGCSE", subject_tag: "Physics" },
];

describe("#700 tailored marketplace split", () => {
  it("puts the learner's curriculum first, subject hits ahead, others after", () => {
    const { recommended, others } = splitTailored(notes, {
      curriculum: "IB",
      subjects: ["Physics"],
    });
    expect(recommended.map((n) => n.id)).toEqual(["c", "b"]);
    expect(others.map((n) => n.id)).toEqual(["a", "d"]);
  });

  it("falls back to subject matching when no curriculum is known", () => {
    const { recommended } = splitTailored(notes, { curriculum: null, subjects: ["Physics"] });
    expect(recommended.map((n) => n.id)).toEqual(["c", "d"]);
  });

  it("leaves the feed untouched without tailoring", () => {
    const { recommended, others } = splitTailored(notes, null);
    expect(recommended).toEqual([]);
    expect(others).toHaveLength(4);
  });
});
