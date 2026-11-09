import { describe, expect, it } from "vitest";

import {
  buildLocalePath,
  parseLocalePath,
  resolveLocaleGateTarget,
  segmentOfLocale,
  stripLocalePrefix,
} from "../../src/features/i18n/routing";

function request(url: string, headers: Record<string, string> = {}): Request {
  return new Request(`https://matchmax.hk${url}`, { headers });
}

describe("parseLocalePath / buildLocalePath round-trip", () => {
  it("parses the four prefixed shapes", () => {
    expect(parseLocalePath("/en")).toEqual({ segment: "en", rest: "/" });
    expect(parseLocalePath("/zh")).toEqual({ segment: "zh", rest: "/" });
    expect(parseLocalePath("/en/tutors")).toEqual({ segment: "en", rest: "/tutors" });
    expect(parseLocalePath("/zh/tutors?q=x")).toEqual({ segment: "zh", rest: "/tutors?q=x" });
  });

  it("rejects unprefixed and case-variant paths (the gate normalizes those)", () => {
    expect(parseLocalePath("/tutors")).toBeNull();
    expect(parseLocalePath("/EN/tutors")).toBeNull();
    expect(parseLocalePath("/Zh")).toBeNull();
  });

  it("builds and strips symmetrically", () => {
    for (const path of ["/", "/tutors", "/tutors?ref=abc"]) {
      for (const segment of ["en", "zh"] as const) {
        const built = buildLocalePath(segment, path);
        const parsed = parseLocalePath(built);
        expect(parsed?.segment).toBe(segment);
        expect(parsed?.rest).toBe(path === "" ? "/" : path);
        expect(stripLocalePrefix(built)).toBe(path === "" ? "/" : path);
      }
    }
  });

  it("segmentOfLocale maps both locales", () => {
    expect(segmentOfLocale("en")).toBe("en");
    expect(segmentOfLocale("zh-HK")).toBe("zh");
  });
});

describe("resolveLocaleGateTarget (the server / → /en|/zh|/cn gate)", () => {
  it("?hl= overrides the saved cookie (shareable links stay shareable)", () => {
    expect(
      resolveLocaleGateTarget(request("/pricing?hl=en", { cookie: "matchmax.locale=zh-HK" })),
    ).toEqual({ locale: "en", personal: false });
  });

  it("an explicit ?hl= is a stable, cacheable target", () => {
    expect(resolveLocaleGateTarget(request("/?hl=zh-HK"))).toEqual({
      locale: "zh-HK",
      personal: false,
    });
  });

  it("falls back to the saved cookie, marked personal so it is never cached", () => {
    expect(
      resolveLocaleGateTarget(request("/pricing", { cookie: "matchmax.locale=zh-CN" })),
    ).toEqual({ locale: "zh-CN", personal: true });
  });

  it("ignores Accept-Language so every cookieless client (crawlers) gets the same target", () => {
    for (const acceptLanguage of ["zh-HK,zh", "zh-TW", "zh-CN,zh;q=0.9", "en-US,en"]) {
      expect(
        resolveLocaleGateTarget(request("/tutors", { "accept-language": acceptLanguage })),
      ).toEqual({ locale: "en", personal: false });
    }
    expect(resolveLocaleGateTarget(request("/"))).toEqual({ locale: "en", personal: false });
  });

  it("ignores an unsupported cookie value", () => {
    expect(resolveLocaleGateTarget(request("/", { cookie: "matchmax.locale=fr" }))).toEqual({
      locale: "en",
      personal: false,
    });
  });
});
