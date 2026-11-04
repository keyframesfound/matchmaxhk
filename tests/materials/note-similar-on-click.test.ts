import { describe, expect, it } from "vitest";

import { similarOnClick, type SimilarItem } from "../../src/features/materials/note-recommend";

const item = (id: string, over: Partial<SimilarItem> = {}): SimilarItem => ({
  id,
  curriculumTag: "IB",
  subjectTag: "Economics HL",
  subcategory: "paper_1",
  searchTags: [],
  tutorId: `t-${id}`,
  soldCount: 0,
  ratingAverage: null,
  priceHkd: 98,
  ...over,
});

describe("similar-on-click (#557 / #626 Child 2)", () => {
  const seed = item("seed");

  it("never shows the viewed note and returns at most 6", () => {
    const pool = [seed, ...Array.from({ length: 10 }, (_, i) => item(`n${i}`))];
    const out = similarOnClick(seed, pool);
    expect(out).toHaveLength(6);
    expect(out.map((n) => n.id)).not.toContain("seed");
  });

  it("locks slots 1-5 to the same curriculum and subject", () => {
    const pool = [
      ...Array.from({ length: 5 }, (_, i) => item(`same${i}`)),
      item("bio", { subjectTag: "Biology HL" }),
      item("dse", { curriculumTag: "DSE" }),
    ];
    const out = similarOnClick(seed, pool);
    expect(out.slice(0, 5).every((n) => n.subjectTag === "Economics HL")).toBe(true);
    expect(out.map((n) => n.id)).not.toContain("dse");
  });

  it("caps one author at 2 of 6", () => {
    const pool = Array.from({ length: 8 }, (_, i) => item(`a${i}`, { tutorId: "same-author" }));
    pool.push(...Array.from({ length: 4 }, (_, i) => item(`b${i}`)));
    const out = similarOnClick(seed, pool);
    expect(out.filter((n) => n.tutorId === "same-author").length).toBeLessThanOrEqual(2);
  });

  it("uses slot 6 to diversify within the same curriculum", () => {
    const pool = [
      ...Array.from({ length: 6 }, (_, i) => item(`p1-${i}`)),
      item("ia", { subcategory: "ia" }),
    ];
    const out = similarOnClick(seed, pool);
    expect(out.map((n) => n.id)).toContain("ia");
  });

  it("respects active Explore filters", () => {
    const pool = [item("x"), item("y", { curriculumTag: "DSE", subjectTag: "Economics HL" })];
    const out = similarOnClick(seed, pool, { activeFilters: { curriculum: "DSE" } });
    expect(out.map((n) => n.id)).not.toContain("x");
  });
});
