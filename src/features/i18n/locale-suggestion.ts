/**
 * "Switch to 中文?" suggestion (2026-11-09). Since the SEO fix, unprefixed
 * URLs always land on /en, so Chinese-language browsers no longer get an
 * automatic redirect. Instead, an English page offers the browser's Chinese
 * variant once; switching or dismissing silences it for good. Client-only:
 * crawlers and SSR never see it.
 */

import { normalizeLocale, type SeoLocale } from "./seo";

export const LOCALE_SUGGESTION_DISMISSED_KEY = "matchmax.locale_suggestion_dismissed";

/**
 * The Chinese variant a browser ranks above English, or null. Unlike the
 * old soft redirect, mainland browsers are offered Simplified: the banner is
 * an opt-in choice, so it respects the "English first, 繁 / 简 optional" rule.
 */
export function browserChineseLocale(languages: readonly string[]): SeoLocale | null {
  for (const raw of languages) {
    const tag = raw.toLowerCase().split(";")[0].trim();
    if (tag.startsWith("en")) return null;
    if (tag.startsWith("zh")) return normalizeLocale(tag);
  }
  return null;
}

export function localeSuggestion(input: {
  urlLocale: SeoLocale;
  preferred: SeoLocale | null;
  dismissed: boolean;
  languages: readonly string[];
}): SeoLocale | null {
  if (input.urlLocale !== "en" || input.preferred || input.dismissed) return null;
  return browserChineseLocale(input.languages);
}

export function readSuggestionDismissed(): boolean {
  try {
    return window.localStorage.getItem(LOCALE_SUGGESTION_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function persistSuggestionDismissed(): void {
  try {
    window.localStorage.setItem(LOCALE_SUGGESTION_DISMISSED_KEY, "1");
  } catch {
    // Storage blocked: the banner just reappears next visit.
  }
}
