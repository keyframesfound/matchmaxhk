import { describe, expect, it } from "vitest";

import { browserChineseLocale, localeSuggestion } from "../../src/features/i18n/locale-suggestion";

const base = { urlLocale: "en" as const, preferred: null, dismissed: false };

describe("browserChineseLocale", () => {
  it("maps HK/TW/generic zh browsers to Traditional", () => {
    expect(browserChineseLocale(["zh-HK", "zh", "en"])).toBe("zh-HK");
    expect(browserChineseLocale(["zh-TW"])).toBe("zh-HK");
    expect(browserChineseLocale(["zh"])).toBe("zh-HK");
  });

  it("maps mainland / Singapore / Hans browsers to Simplified", () => {
    expect(browserChineseLocale(["zh-CN", "zh", "en"])).toBe("zh-CN");
    expect(browserChineseLocale(["zh-SG"])).toBe("zh-CN");
    expect(browserChineseLocale(["zh-Hans-HK"])).toBe("zh-CN");
  });

  it("returns null when English is preferred over Chinese", () => {
    expect(browserChineseLocale(["en-US", "zh-HK"])).toBeNull();
    expect(browserChineseLocale(["fr", "en-GB", "zh"])).toBeNull();
    expect(browserChineseLocale([])).toBeNull();
  });
});

describe("localeSuggestion", () => {
  it("suggests the browser's Chinese variant on an English page", () => {
    expect(localeSuggestion({ ...base, languages: ["zh-HK"] })).toBe("zh-HK");
    expect(localeSuggestion({ ...base, languages: ["zh-CN"] })).toBe("zh-CN");
  });

  it("stays quiet once the visitor has chosen a language", () => {
    expect(localeSuggestion({ ...base, preferred: "en", languages: ["zh-HK"] })).toBeNull();
  });

  it("stays quiet after the banner was dismissed", () => {
    expect(localeSuggestion({ ...base, dismissed: true, languages: ["zh-HK"] })).toBeNull();
  });

  it("only appears on English pages", () => {
    expect(localeSuggestion({ ...base, urlLocale: "zh-HK", languages: ["zh-CN"] })).toBeNull();
  });
});
