import { describe, expect, it } from "vitest";

import {
  barPosition,
  buildPriceGuide,
  priceVerdict,
  selectComparables,
  type ComparableListing,
} from "../../src/features/materials/price-guide";

const listing = (id: string, price: number, extra: Partial<ComparableListing> = {}) =>
  ({
    id,
    slug: id,
    title: id,
    priceHkd: price,
    materialType: "notes",
    curriculumTag: "IB",
    subjectTag: "Biology",
    subcategory: "ia",
    pageCount: 20,
    ...extra,
  }) satisfies ComparableListing;

describe("selectComparables", () => {
  it("uses the narrowest tier with at least 3 listings", () => {
    const pool = [listing("a", 80), listing("b", 100), listing("c", 120), listing("d", 300)];
    expect(
      selectComparables(
        { materialType: "notes", curriculumTag: "IB", subjectTag: "Biology", subcategory: "ia" },
        pool,
      ).tier,
    ).toBe("subcategory");
  });
  it("widens to subject, curriculum, then type", () => {
    const pool = [
      listing("a", 80, { subcategory: "ee" }),
      listing("b", 90, { subcategory: null }),
      listing("c", 100, { subcategory: "tok" }),
    ];
    expect(
      selectComparables(
        { materialType: "notes", curriculumTag: "IB", subjectTag: "Biology", subcategory: "ia" },
        pool,
      ).tier,
    ).toBe("subject");
    const other = pool.map((l) => ({ ...l, subjectTag: "Chemistry" }));
    expect(
      selectComparables(
        { materialType: "notes", curriculumTag: "IB", subjectTag: "Biology" },
        other,
      ).tier,
    ).toBe("curriculum");
    const dse = pool.map((l) => ({ ...l, curriculumTag: "DSE" }));
    expect(
      selectComparables({ materialType: "notes", curriculumTag: "IB", subjectTag: "Biology" }, dse)
        .tier,
    ).toBe("type");
  });
  it("ignores free listings, other types and the listing itself", () => {
    const pool = [
      listing("self", 50),
      listing("free", 0),
      listing("mock", 70, { materialType: "mock" }),
      listing("x", 90),
    ];
    expect(selectComparables({ materialType: "notes", excludeId: "self" }, pool).tier).toBe(
      "baseline",
    );
  });
});

describe("buildPriceGuide", () => {
  it("returns quartiles of the comparables", () => {
    const pool = [
      listing("a", 60),
      listing("b", 80),
      listing("c", 100),
      listing("d", 120),
      listing("e", 140),
    ];
    const guide = buildPriceGuide(
      { materialType: "notes", curriculumTag: "IB", subjectTag: "Biology", subcategory: "ia" },
      pool,
    );
    expect(guide).toMatchObject({ low: 80, mid: 100, high: 120, min: 60, max: 140, sampleSize: 5 });
    expect(guide.comparables[0].priceHkd).toBe(100);
  });
  it("falls back to the per-type baseline", () => {
    const guide = buildPriceGuide({ materialType: "exemplar" }, []);
    expect(guide).toMatchObject({ tier: "baseline", low: 120, mid: 220, high: 380 });
  });
});

describe("priceVerdict / barPosition", () => {
  const guide = { low: 80, high: 120, min: 40, max: 200 };
  it("classifies prices", () => {
    expect(priceVerdict(40, guide)).toBe("too_low");
    expect(priceVerdict(70, guide)).toBe("low");
    expect(priceVerdict(100, guide)).toBe("competitive");
    expect(priceVerdict(150, guide)).toBe("high");
    expect(priceVerdict(400, guide)).toBe("too_high");
    expect(priceVerdict(0, guide)).toBeNull();
  });
  it("clamps the bar position", () => {
    expect(barPosition(40, guide)).toBe(0);
    expect(barPosition(500, guide)).toBe(100);
    expect(barPosition(120, guide)).toBe(50);
  });
});
