import { describe, it, expect } from "vitest";

import {
  MAX_PROFILE_TAGS,
  MAX_PROFILE_TAG_LENGTH,
  mergeCaseTags,
  normalizeProfileTag,
  parseProfileTags,
  popularProfileTags,
  PRESET_PROFILE_TAGS,
} from "../../src/features/tutors/profile-tags";

/**
 * Issues #217 + #311 — the tag vocabulary rules, tested as pure functions
 * (same precedent as tests/materials: server fns are not testable
 * end-to-end, so the normalization/dedupe/count pipeline carries the
 * assertions).
 */

describe("normalizeProfileTag (#311 normalise before save)", () => {
  it("lowercases, strips the leading hash, and trims", () => {
    expect(normalizeProfileTag("  #IA Review ")).toBe("ia review");
    expect(normalizeProfileTag("###TOK")).toBe("tok");
  });

  it("turns hyphens and underscores into a single space", () => {
    // The acceptance case: all three spellings save as one tag.
    expect(normalizeProfileTag("ia-review")).toBe("ia review");
    expect(normalizeProfileTag("ia_review")).toBe("ia review");
    expect(normalizeProfileTag("ia review")).toBe("ia review");
  });

  it("collapses repeated spaces", () => {
    expect(normalizeProfileTag("past   paper   practice")).toBe("past paper practice");
  });

  it("caps a new tag at 30 characters", () => {
    const long = "a".repeat(40);
    expect(normalizeProfileTag(long)).toHaveLength(MAX_PROFILE_TAG_LENGTH);
    expect(normalizeProfileTag(long)).toBe("a".repeat(MAX_PROFILE_TAG_LENGTH));
  });
});

describe("parseProfileTags", () => {
  it("normalizes and dedupes spellings so ia-review / ia_review collapse", () => {
    const result = parseProfileTags(["IA-review", "ia_review", "IA REVIEW"]);
    expect(result).toEqual({ ok: true, tags: ["ia review"] });
  });

  it("rejects a sixth tag", () => {
    const six = ["a", "b", "c", "d", "e", "f"];
    expect(parseProfileTags(six)).toEqual({ ok: false, error: "too_many" });
  });

  it("keeps five", () => {
    const five = PRESET_PROFILE_TAGS.slice(0, 5);
    expect(parseProfileTags([...five])).toEqual({ ok: true, tags: [...five] });
  });

  it("rejects a tag that looks like a phone number, email, or handle", () => {
    expect(parseProfileTags(["examiner", "91234567"])).toEqual({
      ok: false,
      error: "contact",
      tag: "91234567",
    });
    expect(parseProfileTags(["me@example.com"])).toMatchObject({ ok: false, error: "contact" });
    expect(parseProfileTags(["@tutorhk"])).toMatchObject({ ok: false, error: "contact" });
  });

  it("ignores non-string entries and empty strings", () => {
    expect(parseProfileTags(["tok", 42 as unknown as string, "   "])).toEqual({
      ok: true,
      tags: ["tok"],
    });
    expect(parseProfileTags("not an array")).toEqual({ ok: false, error: "too_many" });
  });
});

describe("popularProfileTags (#311 counts + suggestion threshold)", () => {
  const tutors = [
    { profile_tags: ["ia review", "tok"] },
    { profile_tags: ["ia review"] },
    { profile_tags: ["ia review", "sba"] },
    { profile_tags: ["sba"] },
  ];

  it("returns tags with their tutor counts, most-used first (3+ threshold)", () => {
    // Default minCount is 3 — only "ia review" clears the suggestion bar;
    // "sba" (2) and "tok" (1) stay searchable but unsuggested.
    expect(popularProfileTags(tutors)).toEqual([{ tag: "ia review", count: 3 }]);
    expect(popularProfileTags(tutors, 1)).toEqual([
      { tag: "ia review", count: 3 },
      { tag: "sba", count: 2 },
      { tag: "tok", count: 1 },
    ]);
  });

  it("only suggests a tag once three tutors have saved it", () => {
    const suggested = popularProfileTags(tutors, 3);
    expect(suggested).toEqual([{ tag: "ia review", count: 3 }]);
  });

  it("handles missing tag arrays", () => {
    expect(popularProfileTags([{ profile_tags: undefined as unknown as string[] }])).toEqual([]);
  });
});

describe("mergeCaseTags (#311 one tag table, cap of five per case)", () => {
  it("puts parent picks first and dedupes against derived tags", () => {
    expect(mergeCaseTags(["sba", "IA-review"], ["ia review", "Physics"])).toEqual([
      "sba",
      "ia review",
      "physics",
    ]);
  });

  it("caps the merged list at five", () => {
    const merged = mergeCaseTags(["p1", "p2", "p3"], ["d1", "d2", "d3", "d4"]);
    expect(merged).toHaveLength(MAX_PROFILE_TAGS);
    expect(merged).toEqual(["p1", "p2", "p3", "d1", "d2"]);
  });

  it("normalizes both sources", () => {
    expect(mergeCaseTags(["#TOK_Essay"], ["tok essay"])).toEqual(["tok essay"]);
  });

  it("tolerates null/undefined inputs", () => {
    expect(mergeCaseTags(null, undefined)).toEqual([]);
    expect(mergeCaseTags(["oral"], null)).toEqual(["oral"]);
  });
});
