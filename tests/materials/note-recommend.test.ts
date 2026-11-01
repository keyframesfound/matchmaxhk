import { describe, expect, it } from "vitest";

import {
  recommend,
  scoreAgainstSeed,
  type RecommendItem,
} from "../../src/features/materials/note-recommend";

const item = (id: string, extra: Partial<RecommendItem> = {}): RecommendItem => ({
  id,
  curriculumTag: "IB",
  subjectTag: "Chemistry",
  subcategory: null,
  searchTags: [],
  tutorId: "t1",
  soldCount: 0,
  ratingAverage: null,
  ...extra,
});

describe("#557 recommendation scoring", () => {
  it("applies the issue's weights", () => {
    const seed = item("s", { searchTags: ["IA", "Paper 2"], tutorId: "t1" });
    expect(scoreAgainstSeed(seed, item("a", { tutorId: "t2" }), 0)).toBe(50);
    expect(scoreAgainstSeed(seed, item("b", { subjectTag: "Economics", tutorId: "t2" }), 0)).toBe(
      25,
    );
    expect(scoreAgainstSeed(seed, item("c", { searchTags: ["ia"], tutorId: "t1" }), 0)).toBe(
      50 + 15 + 15,
    );
    expect(scoreAgainstSeed(seed, item("d", { tutorId: "t2", ratingAverage: 4.8 }), 0)).toBe(60);
  });
  it("ranks, excludes seeds and purchased items, and drops weak matches", () => {
    const seed = item("s");
    const pool = [
      item("s"),
      item("same", { tutorId: "t9" }),
      item("bought"),
      item("dse", { curriculumTag: "DSE", subjectTag: "History", tutorId: "t9" }),
      item("ibecon", { subjectTag: "Economics", tutorId: "t9" }),
    ];
    expect(recommend([seed], pool, { exclude: ["bought"] }).map((p) => p.id)).toEqual([
      "same",
      "ibecon",
    ]);
  });
});
