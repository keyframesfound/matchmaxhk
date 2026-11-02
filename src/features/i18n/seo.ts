/**
 * Issue #401: locale-aware SEO meta titles & descriptions.
 *
 * head() callbacks run outside React (and may run during SSR), so they can't
 * use useTranslation(); this module resolves the active locale for meta from
 * the URL segment (/en, /zh) — set per request/navigation by the router's
 * rewrite pair — with English as the source of truth.
 *
 * 2026-10-25: locale subpaths shipped (user decision), superseding the old
 * CEO lock of "no locale subpaths". 2026-11-01: Simplified Chinese ships under
 * /cn as an OPT-IN choice (owner rule: English first, 繁 / 简 options), so
 * mainland browsers still soft-default to English at the / gate.
 */

import { getActiveUrlLocale, segmentOfLocale } from "./routing";

export type SeoLocale = "en" | "zh-HK" | "zh-CN";

export const LOCALE_STORAGE_KEY = "matchmax.locale";
export const LOCALE_COOKIE_KEY = "matchmax.locale";

const SUPPORTED_LOCALES: readonly SeoLocale[] = ["en", "zh-HK", "zh-CN"];

export const SITE_URL = "https://matchmax.hk";

export function isSupportedLocale(value: string | null | undefined): value is SeoLocale {
  return value === "en" || value === "zh-HK" || value === "zh-CN";
}

/**
 * Map any i18next / browser language tag onto a supported locale. zh-CN,
 * zh-SG and zh-Hans are Simplified; every other zh tag is Traditional (HK).
 */
export function normalizeLocale(lng: string | null | undefined): SeoLocale {
  const tag = (lng ?? "").toLowerCase();
  if (!tag.startsWith("zh")) return "en";
  if (tag.startsWith("zh-cn") || tag.startsWith("zh-sg") || tag.startsWith("zh-hans")) {
    return "zh-CN";
  }
  return "zh-HK";
}

/** Header toggle order: English (default) → 繁 → 简 → English. */
export function nextLocaleInCycle(current: SeoLocale): SeoLocale {
  return current === "en" ? "zh-HK" : current === "zh-HK" ? "zh-CN" : "en";
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
 * (zh-CN / zh-SG) stays English by design (Simplified is opt-in only). Never a hard redirect.
 */
export function navigatorLocale(): SeoLocale {
  if (typeof navigator === "undefined") return "en";
  const candidates = [...(navigator.languages ?? []), navigator.language].filter(Boolean);
  // A bare "zh" fallback tag after a mainland tag (mainland Chrome sends
  // "zh-CN,zh;q=0.9,en") must not flip the result to zh-HK.
  let mainlandSeen = false;
  for (const raw of candidates) {
    // Strip the ;q= quality parameter before matching ("zh;q=0.9" is a
    // bare zh tag). navigator.languages entries carry no q values, but
    // defensively normalize anyway.
    const tag = raw.toLowerCase().split(";")[0].trim();
    if (tag.startsWith("zh")) {
      if (tag.startsWith("zh-cn") || tag.startsWith("zh-sg")) {
        mainlandSeen = true;
        continue;
      }
      if (tag === "zh" && mainlandSeen) continue;
      return "zh-HK";
    }
    if (tag.startsWith("en")) return "en";
  }
  return "en";
}

/**
 * The explicit-choice chain: ?hl= soft override for shareable links, then
 * localStorage (device choice), then cookie (survives cleared storage).
 * Returns null when the visitor hasn't chosen, callers then soft-default.
 */
export function readPreferredLocale(): SeoLocale | null {
  if (typeof window === "undefined") return null;
  try {
    const hl = new URLSearchParams(window.location.search).get("hl");
    if (isSupportedLocale(hl)) return hl;
  } catch {
    // URLSearchParams unavailable, skip the override.
  }
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isSupportedLocale(stored)) return stored;
  } catch {
    // Storage unavailable, fall through to the cookie.
  }
  const cookie = readLocaleCookie();
  return isSupportedLocale(cookie) ? cookie : null;
}

/** Locale for head() calls: URL segment → stored choice → navigator → en. */
export function currentSeoLocale(): SeoLocale {
  return getActiveUrlLocale() ?? readPreferredLocale() ?? navigatorLocale();
}

export function seoLocaleFromLanguage(language: string | undefined): SeoLocale {
  return normalizeLocale(language);
}

/** zh-CN copy is optional: meta falls back to the Traditional rendition. */
type LocaleCopy = { en: string; "zh-HK": string; "zh-CN"?: string };

export function pickCopy(copy: LocaleCopy, locale: SeoLocale): string {
  if (locale === "zh-CN") return copy["zh-CN"] ?? copy["zh-HK"];
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
const OG_LOCALE: Record<SeoLocale, string> = { en: "en_HK", "zh-HK": "zh_HK", "zh-CN": "zh_CN" };

export function ogLocaleMeta(locale: SeoLocale): { property: string; content: string }[] {
  return [
    { property: "og:locale", content: OG_LOCALE[locale] },
    ...SUPPORTED_LOCALES.filter((l) => l !== locale).map((l) => ({
      property: "og:locale:alternate",
      content: OG_LOCALE[l],
    })),
  ];
}

export const SUPPORTED_SEO_LOCALES = SUPPORTED_LOCALES;

/**
 * Self-referencing canonical/og URL for a route path under the active locale:
 * canonicalUrl("/pricing") on /zh/pricing → https://matchmax.hk/zh/pricing.
 * `path` is the internal (unprefixed) route path.
 */
export function canonicalUrl(path: string, locale: SeoLocale = currentSeoLocale()): string {
  const base = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}/${segmentOfLocale(locale)}${base}`;
}

/** hreflang alternates (en + zh-HK + x-default → en) for a route's head links. */
export function hreflangLinks(
  path: string,
): { rel: "alternate"; hrefLang: string; href: string }[] {
  // React's DOM prop is `hrefLang`; the lowercase JSX prop logs an
  // "Invalid DOM property" warning on every client-side head re-render.
  return [
    { rel: "alternate", hrefLang: "en", href: canonicalUrl(path, "en") },
    { rel: "alternate", hrefLang: "zh-HK", href: canonicalUrl(path, "zh-HK") },
    { rel: "alternate", hrefLang: "zh-CN", href: canonicalUrl(path, "zh-CN") },
    { rel: "alternate", hrefLang: "x-default", href: canonicalUrl(path, "en") },
  ];
}
