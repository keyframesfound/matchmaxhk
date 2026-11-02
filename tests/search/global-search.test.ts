import { describe, expect, it } from "vitest";

import {
  canonicalTagUsage,
  normalizeTag,
  parseSearchQuery,
  rankGroup,
  scoreEntity,
  suggestTags,
} from "@/features/search/global-search";

describe("global search (#553)", () => {
  it("normalizes tags: lowercase, hyphens, 2-32 chars, no #", () => {
    expect(normalizeTag("#Bio IA")).toBe("bio-ia");
    expect(normalizeTag("#生物IA")).toBe("生物ia");
    expect(normalizeTag("#a")).toBeNull();
    expect(normalizeTag(`#${"x".repeat(33)}`)).toBeNull();
  });

  it("splits keywords and #tags", () => {
    const q = parseSearchQuery("IB maths #exam-prep", ["Probono"]);
    expect(q.tags).toEqual(["exam-prep", "probono"]);
    expect(q.keywords).toEqual(["ib", "maths"]);
  });

  it("matches a tutor code exactly and reports matched-on", () => {
    const s = scoreEntity(
      [
        { label: "Code", value: "MM-T003" },
        { label: "Name", value: "Chan Tai Man" },
      ],
      [],
      parseSearchQuery("mm-t003"),
    );
    expect(s).not.toBeNull();
  });

  it("free text is OR over tokens; non-matching entities drop", () => {
    const fields = [
      { label: "Name", value: "Mr Lee" },
      { label: "Subjects", value: "IB Maths" },
    ];
    const full = scoreEntity(fields, [], parseSearchQuery("Mr Lee IB maths"));
    const partial = scoreEntity(fields, [], parseSearchQuery("Lee chemistry"));
    expect(full && partial && full.score > partial.score).toBe(true);
    expect(scoreEntity(fields, [], parseSearchQuery("physics"))).toBeNull();
  });

  it("selected tag is an exact filter and outranks keyword-only", () => {
    expect(
      scoreEntity(
        [{ label: "Title", value: "Biology notes" }],
        ["bio"],
        parseSearchQuery("#bio-ia"),
      ),
    ).toBeNull();
    const q = parseSearchQuery("biology #bio-ia");
    const tagged = scoreEntity([{ label: "Title", value: "IA guide" }], ["Bio IA"], q);
    const kwOnly = scoreEntity(
      [{ label: "Title", value: "Biology notes" }],
      [],
      parseSearchQuery("biology"),
    );
    expect(tagged && kwOnly && tagged.score > kwOnly.score).toBe(true);
    const ranked = rankGroup([
      { id: "k", scored: kwOnly! },
      { id: "t", scored: tagged! },
    ]);
    expect(ranked[0].id).toBe("t");
  });

  it("applies admin hide and merge overrides", () => {
    const usage = canonicalTagUsage(
      [
        { tag: "bioo", count: 2, lastUsedAt: null },
        { tag: "bio", count: 5, lastUsedAt: "2026-11-01T00:00:00Z" },
        { tag: "rude", count: 9, lastUsedAt: null },
      ],
      [
        { tag: "bioo", hidden: false, mergedInto: "bio" },
        { tag: "rude", hidden: true, mergedInto: null },
      ],
    );
    expect(usage).toEqual([{ tag: "bio", count: 7, lastUsedAt: "2026-11-01T00:00:00Z" }]);
  });

  it("suggests ≤8 tags with prefix first, scripts separate", () => {
    const now = new Date("2026-11-02T00:00:00Z");
    const usages = [
      { tag: "biology-hl", count: 1, lastUsedAt: null },
      { tag: "bio-ia", count: 10, lastUsedAt: "2026-11-01T00:00:00Z" },
      { tag: "micro-bio", count: 30, lastUsedAt: null },
      { tag: "生物ia", count: 50, lastUsedAt: null },
    ];
    const out = suggestTags(usages, "#bio", now);
    expect(out.slice(0, 2)).toEqual(["bio-ia", "biology-hl"]);
    expect(out).not.toContain("生物ia");
    expect(suggestTags(usages, "生物", now)).toEqual(["生物ia"]);
    const many = Array.from({ length: 20 }, (_, i) => ({
      tag: `t${i}x`,
      count: 1,
      lastUsedAt: null,
    }));
    expect(suggestTags(many, "t", now)).toHaveLength(8);
  });
});
