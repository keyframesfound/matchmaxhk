import { describe, expect, it } from "vitest";

import { runWithRequestLocale } from "../../src/features/i18n/request-locale.server";
import { getActiveUrlLocale, setActiveUrlLocale } from "../../src/features/i18n/routing";
import { canonicalUrl } from "../../src/features/i18n/seo";

function request(path: string): Request {
  return new Request(`https://matchmax.hk${path}`);
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe("runWithRequestLocale (per-request SSR locale)", () => {
  it("keeps interleaved requests from reading each other's locale", async () => {
    // Reproduces the SSR race: request A starts, request B's router rewrite
    // overwrites the module-level locale, then A's head() runs.
    const seen: Record<string, string> = {};
    const render = (path: string, label: string) =>
      runWithRequestLocale(request(path), async () => {
        await tick();
        setActiveUrlLocale(label === "zh" ? "zh-HK" : "en");
        await tick();
        seen[label] = canonicalUrl("/tutors");
      });

    await Promise.all([render("/zh/tutors", "zh"), render("/en/tutors", "en")]);

    expect(seen.zh).toBe("https://matchmax.hk/zh/tutors");
    expect(seen.en).toBe("https://matchmax.hk/en/tutors");
  });

  it("resolves each locale segment from the request URL", async () => {
    await runWithRequestLocale(request("/cn/help"), async () => {
      await tick();
      expect(getActiveUrlLocale()).toBe("zh-CN");
    });
  });

  it("falls back to the router-set locale for unprefixed requests", async () => {
    setActiveUrlLocale("zh-HK");
    await runWithRequestLocale(request("/sitemap.xml"), async () => {
      expect(getActiveUrlLocale()).toBe("zh-HK");
    });
    setActiveUrlLocale("en");
  });
});
