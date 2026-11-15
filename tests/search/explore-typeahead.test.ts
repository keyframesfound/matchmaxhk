import { describe, expect, it } from "vitest";

import {
  SUGGESTION_LIMIT,
  toExploreSuggestions,
} from "../../src/features/search/explore-typeahead";

describe("#771 §2.3 Explore keyword typeahead", () => {
  it("orders tags first, then subjects, tutors, schools", () => {
    const rows = toExploreSuggestions({
      tags: ["bio"],
      subjects: ["Biology"],
      tutors: [{ code: "MM-T003", name: "Chan Tai Man" }],
      schools: ["DBS"],
    });
    expect(rows.map((row) => row.kind)).toEqual(["tag", "subject", "tutor", "school"]);
    expect(rows[0]).toEqual({ kind: "tag", value: "bio", label: "#bio" });
    expect(rows[2]).toEqual({
      kind: "tutor",
      value: "MM-T003",
      label: "Chan Tai Man",
      hint: "MM-T003",
    });
  });

  it("caps the list at the typeahead limit", () => {
    const rows = toExploreSuggestions({
      tags: ["a", "b", "c", "d"],
      subjects: ["S1", "S2", "S3"],
      tutors: [
        { code: "MM-T001", name: "A" },
        { code: "MM-T002", name: "B" },
        { code: "MM-T003", name: "C" },
      ],
      schools: ["X", "Y"],
    });
    expect(rows).toHaveLength(SUGGESTION_LIMIT);
    expect(rows[0].kind).toBe("tag");
  });

  it("returns nothing for an empty payload", () => {
    expect(toExploreSuggestions(undefined)).toEqual([]);
    expect(toExploreSuggestions({ tags: [], subjects: [], tutors: [], schools: [] })).toEqual([]);
  });
});
