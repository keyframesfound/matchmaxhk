/**
 * Issue #401: locale-aware SEO meta titles & descriptions.
 *
 * head() callbacks run outside React (and may run during SSR), so they can't
 * use useTranslation(); this module resolves the active locale from the same
 * chain the i18n detector uses (?hl → localStorage → cookie) and falls back
 * to `navigator` soft-defaulting, with English as the source of truth.
 *
 * CEO lock 2026-10-21: hybrid architecture — no locale subpaths or hreflang
 * yet (deferred until zh-HK copy is stable); zh-CN UI strings are deferred,
 * so mainland browsers stay on English for now.
 */

export type SeoLocale = "en" | "zh-HK";

export const LOCALE_STORAGE_KEY = "matchmax.locale";
export const LOCALE_COOKIE_KEY = "matchmax.locale";

const SUPPORTED_LOCALES: readonly SeoLocale[] = ["en", "zh-HK"];

export function isSupportedLocale(value: string | null | undefined): value is SeoLocale {
  return value === "en" || value === "zh-HK";
}

export function readLocaleCookie(): string | null {
  if (typeof document === "undefined") return null;
  try {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE_KEY}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

/**
 * Soft navigator mapping: HK/TW/MO/generic-zh browsers → zh-HK; mainland
 * (zh-CN / zh-SG) stays English until zh-CN UI ships. Never a hard redirect.
 */
export function navigatorLocale(): SeoLocale {
  if (typeof navigator === "undefined") return "en";
  const candidates = [...(navigator.languages ?? []), navigator.language].filter(Boolean);
  for (const raw of candidates) {
    const tag = raw.toLowerCase();
    if (tag.startsWith("zh")) {
      if (tag.startsWith("zh-cn") || tag.startsWith("zh-sg")) continue;
      return "zh-HK";
    }
    if (tag.startsWith("en")) return "en";
  }
  return "en";
}

/**
 * The explicit-choice chain: ?hl= soft override for shareable links, then
 * localStorage (device choice), then cookie (survives cleared storage).
 * Returns null when the visitor hasn't chosen — callers then soft-default.
 */
export function readPreferredLocale(): SeoLocale | null {
  if (typeof window === "undefined") return null;
  try {
    const hl = new URLSearchParams(window.location.search).get("hl");
    if (isSupportedLocale(hl)) return hl;
  } catch {
    // URLSearchParams unavailable — skip the override.
  }
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isSupportedLocale(stored)) return stored;
  } catch {
    // Storage unavailable — fall through to the cookie.
  }
  const cookie = readLocaleCookie();
  return isSupportedLocale(cookie) ? cookie : null;
}

/** Locale for head() calls: explicit choice → soft navigator default → en. */
export function currentSeoLocale(): SeoLocale {
  return readPreferredLocale() ?? navigatorLocale();
}

export function seoLocaleFromLanguage(language: string | undefined): SeoLocale {
  return language?.startsWith("zh") ? "zh-HK" : "en";
}

type LocaleCopy = { en: string; "zh-HK": string };

export function pickCopy(copy: LocaleCopy, locale: SeoLocale): string {
  return copy[locale];
}

export type RouteMetaEntry =
  { title: string } | { name: string; content: string } | { property: string; content: string };

/**
 * Build the locale-aware title/description/OG block for a route head().
 * Routes spread this alongside their static extras (robots, canonical, image).
 * English copy is the source of truth; the zh-HK rendition follows the
 * written-Cantonese conventions used across the locale files.
 */
export function localizedMeta(
  locale: SeoLocale,
  copy: { title: LocaleCopy; description: LocaleCopy },
): RouteMetaEntry[] {
  const title = pickCopy(copy.title, locale);
  const description = pickCopy(copy.description, locale);
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
  ];
}

/**
 * og:locale for the active language, with the alternate listed so scrapers
 * see both renditions. zh-HK uses the `zh_HK` Facebook locale code.
 */
export function ogLocaleMeta(locale: SeoLocale): { property: string; content: string }[] {
  return [
    { property: "og:locale", content: locale === "zh-HK" ? "zh_HK" : "en_HK" },
    {
      property: "og:locale:alternate",
      content: locale === "zh-HK" ? "en_HK" : "zh_HK",
    },
  ];
}

export const SUPPORTED_SEO_LOCALES = SUPPORTED_LOCALES;
