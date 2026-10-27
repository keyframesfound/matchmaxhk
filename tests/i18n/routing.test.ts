import { describe, expect, it } from "vitest";

import {
  buildLocalePath,
  parseLocalePath,
  resolvePreferredLocaleForRequest,
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

describe("resolvePreferredLocaleForRequest (the server 307 gate)", () => {
  it("?hl= overrides the saved cookie (shareable links stay shareable)", () => {
    const res = resolvePreferredLocaleForRequest(
      request("/pricing?hl=en", { cookie: "matchmax.locale=zh-HK" }),
    );
    expect(res).toBe("en");
  });

  it("falls back to the cookie when no ?hl=", () => {
    expect(
      resolvePreferredLocaleForRequest(request("/pricing", { cookie: "matchmax.locale=zh-HK" })),
    ).toBe("zh-HK");
  });

  it("mainland Chrome (zh-CN + bare zh fallback) stays English", () => {
    // Mainland Chrome sends exactly this shape; the bare zh fallback tag
    // must not flip the result to zh-HK.
    expect(
      resolvePreferredLocaleForRequest(
        request("/", { "accept-language": "zh-CN,zh;q=0.9,en;q=0.8" }),
      ),
    ).toBe("en");
    expect(
      resolvePreferredLocaleForRequest(request("/", { "accept-language": "zh-SG,zh;q=0.9" })),
    ).toBe("en");
  });

  it("HK/TW/MO/generic-zh browsers get zh-HK", () => {
    expect(resolvePreferredLocaleForRequest(request("/", { "accept-language": "zh-HK,zh" }))).toBe(
      "zh-HK",
    );
    expect(resolvePreferredLocaleForRequest(request("/", { "accept-language": "zh-TW" }))).toBe(
      "zh-HK",
    );
    expect(resolvePreferredLocaleForRequest(request("/", { "accept-language": "zh" }))).toBe(
      "zh-HK",
    );
  });

  it("English browsers and headerless bots stay English", () => {
    expect(resolvePreferredLocaleForRequest(request("/", { "accept-language": "en-US,en" }))).toBe(
      "en",
    );
    expect(resolvePreferredLocaleForRequest(request("/"))).toBe("en");
  });

  it("an explicit ?hl= wins even over a conflicting Accept-Language", () => {
    expect(
      resolvePreferredLocaleForRequest(request("/?hl=zh-HK", { "accept-language": "en-US" })),
    ).toBe("zh-HK");
  });
});
