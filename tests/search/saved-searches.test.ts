import { describe, expect, it } from "vitest";

import {
  addSavedSearch,
  hasSavableFilters,
  normalizeSearchParams,
  searchKey,
} from "../../src/features/search/saved-searches";

describe("#725 saved searches", () => {
  it("drops empty and transient keys and sorts the rest", () => {
    expect(
      normalizeSearchParams({
        view: "materials",
        open: true,
        subject: "Physics",
        category: "IB",
        q: "",
      }),
    ).toEqual({ category: "IB", subject: "Physics" });
    expect(hasSavableFilters({ open: true, post: true })).toBe(false);
  });

  it("treats the same filters in any order as one saved search", () => {
    expect(searchKey("tutors", { subject: "Physics", category: "IB" })).toBe(
      searchKey("tutors", { category: "IB", subject: "Physics", open: true }),
    );
  });

  it("adds newest first, dedupes, and respects the cap", () => {
    const one = addSavedSearch(
      [],
      { scope: "tutors", params: { category: "IB" }, label: "IB" },
      2,
      1,
    );
    expect(one).toHaveLength(1);
    const dup = addSavedSearch(
      one!,
      { scope: "tutors", params: { category: "IB" }, label: "IB" },
      2,
      2,
    );
    expect(dup).toHaveLength(1);
    const two = addSavedSearch(
      one!,
      { scope: "cases", params: { district: "Sha Tin" }, label: "Sha Tin" },
      2,
      3,
    );
    expect(two!.map((s) => s.label)).toEqual(["Sha Tin", "IB"]);
    const full = addSavedSearch(
      two!,
      { scope: "tutors", params: { q: "MM-T001" }, label: "MM-T001" },
      2,
      4,
    );
    expect(full).toBeNull();
  });
});
