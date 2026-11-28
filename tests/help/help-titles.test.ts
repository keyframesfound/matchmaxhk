import { describe, expect, it } from "vitest";

import { HELP_ARTICLES, HELP_CATEGORIES } from "../../src/features/help/content";
import {
  HELP_ARTICLE_TITLES,
  HELP_CATEGORY_NAMES,
  localizedHelpArticleTitle,
  localizedHelpCategoryName,
} from "../../src/features/help/help-titles";

// #824: Help Centre chrome is locale-aware. Every registry entry needs both
// Chinese renditions, and /cn must never receive a Traditional title.

const TRADITIONAL_TOKENS = [
  "爭議",
  "補習",
  "導師",
  "家長",
  "課堂",
  "賬戶",
  "個人資料",
  "中心與",
  // 退款 is identical in both scripts (退款 / 退款), so it is not a
  // Traditional-only discriminator and cannot be rejected here.
];

// High-signal Traditional-only glyphs drawn from this vocabulary. Each one has
// a different Simplified form, so finding any of them in a zh-CN value means
// the Traditional copy leaked.
const TRADITIONAL_CHARS = [
  "與",
  "為",
  "個",
  "嗎",
  "學",
  "習",
  "進",
  "開",
  "單",
  "課",
  "師",
  "長",
  "認",
  "證",
  "護",
  "費",
  "時",
  "間",
  "後",
  "爭",
  "議",
  "筆",
  "獨",
  "別",
  "請",
  "計",
  "對",
  "覽",
  "選",
  "適",
  "準",
  "備",
  "給",
  "週",
  "導",
  "較",
  "標",
  "實",
  "務",
  "饋",
  "贏",
  "關",
  "係",
  "確",
  "門",
  "診",
  "斷",
  "講",
  "讀",
  "動",
  "機",
  "藍",
  "資",
  "庫",
  "聯",
  "絡",
  "續",
  "線",
  "誠",
];

const allEntries = [
  ...Object.entries(HELP_CATEGORY_NAMES).map(([slug, names]) => ({
    kind: "category",
    slug,
    names,
  })),
  ...Object.entries(HELP_ARTICLE_TITLES).map(([slug, names]) => ({
    kind: "article",
    slug,
    names,
  })),
];

function traditionalCharsIn(value: string): string[] {
  return TRADITIONAL_CHARS.filter((char) => value.includes(char));
}

describe("Help titles: registry coverage", () => {
  it("covers all 14 categories with zh-HK and zh-CN names", () => {
    expect(HELP_CATEGORIES).toHaveLength(14);
    expect(Object.keys(HELP_CATEGORY_NAMES)).toHaveLength(14);
    for (const category of HELP_CATEGORIES) {
      const names = HELP_CATEGORY_NAMES[category.slug];
      expect(names, `missing category names for ${category.slug}`).toBeDefined();
      expect(names["zh-HK"].trim()).not.toBe("");
      expect(names["zh-CN"].trim()).not.toBe("");
    }
  });

  it("covers all 31 articles with zh-HK and zh-CN titles", () => {
    expect(HELP_ARTICLES).toHaveLength(31);
    expect(Object.keys(HELP_ARTICLE_TITLES)).toHaveLength(31);
    for (const article of HELP_ARTICLES) {
      const names = HELP_ARTICLE_TITLES[article.slug];
      expect(names, `missing article titles for ${article.slug}`).toBeDefined();
      expect(names["zh-HK"].trim()).not.toBe("");
      expect(names["zh-CN"].trim()).not.toBe("");
    }
  });

  it("has no empty or whitespace-only rendition in either locale", () => {
    for (const { kind, slug, names } of allEntries) {
      for (const locale of ["zh-HK", "zh-CN"] as const) {
        expect(names[locale].trim(), `${kind} ${slug} (${locale})`).not.toBe("");
      }
    }
  });
});

describe("Help titles: zh-CN uses Simplified only", () => {
  it("contains no Traditional-only tokens", () => {
    for (const { kind, slug, names } of allEntries) {
      for (const token of TRADITIONAL_TOKENS) {
        expect(
          names["zh-CN"].includes(token),
          `${kind} ${slug} zh-CN leaks Traditional "${token}"`,
        ).toBe(false);
      }
    }
  });

  it("contains no Traditional-only glyphs", () => {
    for (const { kind, slug, names } of allEntries) {
      const leaked = traditionalCharsIn(names["zh-CN"]);
      expect(leaked, `${kind} ${slug} zh-CN leaks ${leaked.join(", ")}`).toEqual([]);
    }
  });
});

describe("Help titles: helper fallbacks", () => {
  const category = HELP_CATEGORIES[0];
  const article = HELP_ARTICLES[0];

  it("returns the authored English copy for en", () => {
    expect(localizedHelpCategoryName(category.name, category.slug, "en")).toBe(category.name);
    expect(localizedHelpArticleTitle(article.title, article.slug, "en")).toBe(article.title);
  });

  it("returns the locale rendition for zh-HK and zh-CN", () => {
    expect(localizedHelpCategoryName(category.name, category.slug, "zh-HK")).toBe(
      HELP_CATEGORY_NAMES[category.slug]["zh-HK"],
    );
    expect(localizedHelpCategoryName(category.name, category.slug, "zh-CN")).toBe(
      HELP_CATEGORY_NAMES[category.slug]["zh-CN"],
    );
    expect(localizedHelpArticleTitle(article.title, article.slug, "zh-CN")).toBe(
      HELP_ARTICLE_TITLES[article.slug]["zh-CN"],
    );
  });

  it("falls back to English for an unknown slug", () => {
    expect(localizedHelpArticleTitle("Some future article", "not-registered-yet", "zh-HK")).toBe(
      "Some future article",
    );
    expect(localizedHelpCategoryName("Future category", "not-registered-yet", "zh-CN")).toBe(
      "Future category",
    );
  });
});
