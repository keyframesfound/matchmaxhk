import { describe, expect, it } from "vitest";

import { localizedMeta, pickCopy } from "@/features/i18n/seo";

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
});
