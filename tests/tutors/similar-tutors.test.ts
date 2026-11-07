import { describe, expect, it } from "vitest";

import { orderBySimilarIds, similarFiltersFromSearch } from "@/features/tutors/similar-tutors";

describe("similarFiltersFromSearch (#563)", () => {
  it("maps directory filters onto the RPC's active_filters", () => {
    expect(
      similarFiltersFromSearch({
        subject: "Chem HL",
        category: "IBDP",
        max_price: 300,
        mode: "online",
        gender: "female",
        station: "Sha Tin",
      }),
    ).toEqual({
      subject: "Chem HL",
      curriculum: "IBDP",
      max_rate_hkd: 300,
      mode: "online",
      strict_gender: "female",
      district: "Sha Tin",
    });
  });

  it("returns an empty object with no filters, so the seed decides", () => {
    expect(similarFiltersFromSearch({})).toEqual({});
  });

  it("drops values that are not filters", () => {
    expect(similarFiltersFromSearch({ category: "Sciences", mode: "either" })).toEqual({});
  });
});

describe("orderBySimilarIds (#563)", () => {
  const tutors = [{ id: "b" }, { id: "a" }];

  it("keeps the RPC's slot order and attaches each reason", () => {
    const rows = [
      { id: "a", match_reason_key: "strict" },
      { id: "b", match_reason_key: "value" },
    ];
    expect(orderBySimilarIds(tutors, rows)).toEqual([
      { tutor: { id: "a" }, reason: "strict" },
      { tutor: { id: "b" }, reason: "value" },
    ]);
  });

  it("skips ids the public read did not return", () => {
    const rows = [{ id: "gone", match_reason_key: "strict" }];
    expect(orderBySimilarIds(tutors, rows)).toEqual([]);
  });
});
