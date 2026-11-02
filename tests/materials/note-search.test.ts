import { describe, expect, it } from "vitest";

import {
  editDistance,
  foldSimplified,
  normalizeSearchText,
  parseQuery,
  rankBySearch,
} from "../../src/features/materials/note-search";

type Item = { id: string; title: string; description?: string; tags?: string[] };

const items: Item[] = [
  {
    id: "ia",
    title: "IB Biology IA exemplar 7/7",
    description: "Full internal assessment write-up",
  },
  { id: "dse", title: "DSE 中文 卷一 閱讀能力 歷屆試題 筆記" },
  { id: "phys", title: "IGCSE Physics revision notes", tags: ["formula sheet"] },
  { id: "media", title: "Media studies essay" },
  { id: "econ", title: "HKDSE Economics Paper 2 mock", description: "模擬試卷 with answers" },
];

const rank = (q: string) =>
  rankBySearch(items, q, (i) => ({
    primary: [i.title, ...(i.tags ?? [])],
    secondary: [i.description ?? ""],
  })).map((i) => i.id);

describe("normalisation", () => {
  it("folds Simplified onto Traditional and full-width onto ASCII", () => {
    expect(foldSimplified("历届试题")).toBe("歷屆試題");
    expect(normalizeSearchText("ＩＢ　Ｂｉｏ")).toBe("ib bio");
  });
});

describe("synonyms", () => {
  it("matches IA across English and Chinese", () => {
    expect(rank("internal assessment")).toEqual(["ia"]);
    expect(rank("內部評估")).toEqual(["ia"]);
    expect(rank("内部评估")).toEqual(["ia"]);
  });
  it("does not match 'ia' inside other words", () => {
    expect(rank("ia")).not.toContain("media");
  });
  it("matches past papers in Simplified Chinese and English", () => {
    expect(rank("历届试题")).toContain("dse");
    expect(rank("past paper")).toContain("dse");
  });
  it("maps paper 1 to 卷一 and mock to 模擬", () => {
    expect(rank("dse paper 1")).toContain("dse");
    expect(rank("economics mock")).toEqual(["econ"]);
  });
});

describe("typos and partial words", () => {
  it("tolerates a one-letter typo in longer words", () => {
    expect(rank("phisics")).toEqual(["phys"]);
    expect(rank("biolgy")).toContain("ia");
  });
  it("matches Chinese runs by bigrams", () => {
    expect(rank("閱讀能力筆記")).toContain("dse");
  });
  it("keeps the original order for an empty query", () => {
    expect(rank("  ")).toEqual(items.map((i) => i.id));
  });
});

describe("helpers", () => {
  it("editDistance exits early", () => {
    expect(editDistance("physics", "phisics", 1)).toBe(1);
    expect(editDistance("abc", "xyz123", 1)).toBeGreaterThan(1);
  });
  it("parseQuery groups synonym phrases into one concept", () => {
    expect(parseQuery("theory of knowledge essay")).toHaveLength(2);
  });
});
