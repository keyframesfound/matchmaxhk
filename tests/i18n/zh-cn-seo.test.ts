import { describe, expect, it } from "vitest";

// Relative import: this suite runs without a vitest alias config, so the
// "@/..." path resolves in the bundler but not under `vitest run` (unlike the
// sibling i18n test, which already imports relatively).
import { localizedMeta, pickCopy, resolveMetaCopy } from "../../src/features/i18n/seo";

const copy = {
  title: { en: "Home | MatchMax", "zh-HK": "主頁 | MatchMax", "zh-CN": "主页 | MatchMax" },
  description: { en: "Desc", "zh-HK": "描述（繁）", "zh-CN": "描述（简）" },
};

describe("#824 §2.1 zh-CN meta (AC-401-1, AC-401-3)", () => {
  it("serves the Simplified copy on zh-CN, never the Traditional fallback", () => {
    expect(pickCopy(copy.title, "zh-CN")).toBe("主页 | MatchMax");
    const meta = localizedMeta("zh-CN", copy);
    expect(meta).toContainEqual({ title: "主页 | MatchMax" });
    expect(meta).toContainEqual({ property: "og:description", content: "描述（简）" });
    expect(JSON.stringify(meta)).not.toMatch(/主頁|繁/);
  });

  it("keeps the English and Traditional copy unchanged", () => {
    expect(pickCopy(copy.title, "en")).toBe("Home | MatchMax");
    expect(pickCopy(copy.title, "zh-HK")).toBe("主頁 | MatchMax");
  });

  // The twitter:/og: overrides that used to branch on `locale !== "en"`
  // resolve through the same map, so /cn gets Simplified there too.
  it("resolves a title/description pair for the social-card overrides", () => {
    expect(resolveMetaCopy("zh-CN", copy)).toEqual({
      title: "主页 | MatchMax",
      description: "描述（简）",
    });
    expect(resolveMetaCopy("en", copy)).toEqual({ title: "Home | MatchMax", description: "Desc" });
    expect(resolveMetaCopy("zh-HK", copy)).toEqual({
      title: "主頁 | MatchMax",
      description: "描述（繁）",
    });
  });
});
