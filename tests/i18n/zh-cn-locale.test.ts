import { describe, expect, it } from "vitest";

import {
  buildLocalePath,
  localeOfSegment,
  parseLocalePath,
  resolveLocaleGateTarget,
  segmentOfLocale,
} from "../../src/features/i18n/routing";
import { nextLocaleInCycle, normalizeLocale, pickCopy } from "../../src/features/i18n/seo";

describe("Simplified Chinese locale (/cn)", () => {
  it("maps zh-CN to the /cn segment and back", () => {
    expect(segmentOfLocale("zh-CN")).toBe("cn");
    expect(localeOfSegment("cn")).toBe("zh-CN");
    expect(parseLocalePath("/cn/tutors")).toEqual({ segment: "cn", rest: "/tutors" });
    expect(parseLocalePath("/cnx")).toBeNull();
    expect(buildLocalePath("cn", "/guide/notes")).toBe("/cn/guide/notes");
  });

  it("normalises language tags", () => {
    expect(normalizeLocale("zh-CN")).toBe("zh-CN");
    expect(normalizeLocale("zh-Hans-CN")).toBe("zh-CN");
    expect(normalizeLocale("zh-HK")).toBe("zh-HK");
    expect(normalizeLocale("zh-TW")).toBe("zh-HK");
    expect(normalizeLocale("en-GB")).toBe("en");
    expect(normalizeLocale(undefined)).toBe("en");
  });

  it("cycles EN -> 繁 -> 简 -> EN", () => {
    expect(nextLocaleInCycle("en")).toBe("zh-HK");
    expect(nextLocaleInCycle("zh-HK")).toBe("zh-CN");
    expect(nextLocaleInCycle("zh-CN")).toBe("en");
  });

  it("keeps English as the default for mainland browsers (opt-in only)", () => {
    const request = new Request("https://matchmax.hk/tutors", {
      headers: { "accept-language": "zh-CN,zh;q=0.9,en;q=0.8" },
    });
    expect(resolveLocaleGateTarget(request).locale).toBe("en");
  });

  it("honours an explicit Simplified choice (cookie or ?hl=)", () => {
    const viaCookie = new Request("https://matchmax.hk/tutors", {
      headers: { cookie: "matchmax.locale=zh-CN" },
    });
    expect(resolveLocaleGateTarget(viaCookie).locale).toBe("zh-CN");
    expect(resolveLocaleGateTarget(new Request("https://matchmax.hk/?hl=zh-CN")).locale).toBe(
      "zh-CN",
    );
  });

  it("falls back to the Traditional meta copy when no zh-CN copy exists", () => {
    expect(pickCopy({ en: "A", "zh-HK": "乙" }, "zh-CN")).toBe("乙");
    expect(pickCopy({ en: "A", "zh-HK": "乙", "zh-CN": "乙简" }, "zh-CN")).toBe("乙简");
  });
});
