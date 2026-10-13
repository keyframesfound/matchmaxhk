import { describe, it, expect } from "vitest";

import {
  MAX_CASE_TAGS,
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

  it("merges legacy spellings and dedupes per tutor (#311 review)", () => {
    const mixed = [
      { profile_tags: ["IA-review", "ia review"] }, // same tutor, both spellings → counts once
      { profile_tags: ["ia_review"] },
      { profile_tags: ["ia review"] },
      { profile_tags: ["IA-REVIEW"] },
    ];
    // Normalized: four distinct tutors use "ia review" (the duplicate in
    // tutor 1 doesn't inflate the count); legacy spellings never split it.
    expect(popularProfileTags(mixed)).toEqual([{ tag: "ia review", count: 4 }]);
    expect(popularProfileTags(mixed)[0].tag).not.toContain("-");
  });

  it("handles missing tag arrays", () => {
    expect(popularProfileTags([{ profile_tags: undefined as unknown as string[] }])).toEqual([]);
  });
});

describe("mergeCaseTags (#311 one tag table)", () => {
  it("puts parent picks first and dedupes against derived tags", () => {
    expect(mergeCaseTags(["sba", "IA-review"], ["ia review", "Physics"])).toEqual([
      "sba",
      "ia review",
      "physics",
    ]);
  });

  it("keeps every derived tag even when the parent picks five presets (review blocker)", () => {
    const fivePresets = PRESET_PROFILE_TAGS.slice(0, 5); // examiner, ia review, tok, ee, sba
    const derived = ["physics", "paper 2", "IBDP", "university interview"];
    const merged = mergeCaseTags(fivePresets, derived);
    // All four requirement tags survive; the parent tail (last preset
    // picked) yields first — subjects are never the ones dropped.
    expect(merged.slice(-4)).toEqual(derived.map((t) => t.toLowerCase()));
    expect(merged).toHaveLength(MAX_CASE_TAGS);
    expect(merged.slice(0, 4)).toEqual(fivePresets.slice(0, 4));
  });

  it("parent picks lead the list and only their tail is trimmed", () => {
    const merged = mergeCaseTags(["examiner", "oral", "tok"], ["d1", "d2", "d3", "d4", "d5", "d6"]);
    // room = 8 - 6 = 2 → only the first two parent picks are kept.
    expect(merged).toEqual(["examiner", "oral", "d1", "d2", "d3", "d4", "d5", "d6"]);
    // And with few derived tags nothing is trimmed at all.
    expect(mergeCaseTags(["examiner", "oral"], ["physics"])).toEqual([
      "examiner",
      "oral",
      "physics",
    ]);
  });

  it("drops non-preset parent tags so crafted payloads cannot publish chips", () => {
    expect(
      mergeCaseTags(["91234567", "me@example.com", "@tutorhk", "custom vibe"], ["physics"]),
    ).toEqual(["physics"]);
  });

  it("still drops contact junk that normalizes into a preset spelling", () => {
    // A preset could only be picked from the chip row; anything else,
    // including near-preset contact bait, is dropped.
    expect(mergeCaseTags(["sba\n91234567"], ["chemistry"])).toEqual(["chemistry"]);
  });

  it("normalizes both sources", () => {
    expect(mergeCaseTags(["#TOK_Essay"], ["tok essay"])).toEqual(["tok essay"]);
    // Non-preset input is dropped even when it dedupes against a derived tag.
    expect(mergeCaseTags(["tok essay"], ["tok essay"])).toEqual(["tok essay"]);
  });

  it("tolerates null/undefined inputs", () => {
    expect(mergeCaseTags(null, undefined)).toEqual([]);
    expect(mergeCaseTags(["oral"], null)).toEqual(["oral"]);
  });
});
