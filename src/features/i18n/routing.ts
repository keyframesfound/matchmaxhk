/**
 * Locale URL prefixes (/en, /zh) — 2026-10-25 restructure.
 *
 * The router matches routes against STRIPPED paths (see the `rewrite` pair in
 * router.tsx): /zh/tutors is parsed as /tutors with locale zh-HK, and every
 * URL the router builds (Link hrefs, history commits) gets the active
 * segment re-added. The URL is now the source of truth for language; the
 * stored choice only steers the / → /en|/zh redirect in server.ts.
 */

import type { SeoLocale } from "./seo";

export type LocaleSegment = "en" | "zh";

export const LOCALE_SEGMENTS: readonly LocaleSegment[] = ["en", "zh"];

// Mirror of LOCALE_COOKIE_KEY in seo.ts (importing the value would create a
// runtime cycle seo.ts → routing.ts → seo.ts; the type-only import above is
// erased at build time).
const LOCALE_COOKIE_KEY = "matchmax.locale";

function isSupportedLocaleValue(value: string | null | undefined): value is SeoLocale {
  return value === "en" || value === "zh-HK";
}

const SEGMENT_BY_LOCALE: Record<SeoLocale, LocaleSegment> = { en: "en", "zh-HK": "zh" };
const LOCALE_BY_SEGMENT: Record<LocaleSegment, SeoLocale> = { en: "en", zh: "zh-HK" };

export function segmentOfLocale(locale: SeoLocale): LocaleSegment {
  return SEGMENT_BY_LOCALE[locale];
}

export function localeOfSegment(segment: LocaleSegment): SeoLocale {
  return LOCALE_BY_SEGMENT[segment];
}

const LOCALE_PATH_RE = /^\/(en|zh)(?=\/|$)/;

/** `/en`, `/zh`, `/en/...`, `/zh/...` → { segment, rest } (rest always starts with /). */
export function parseLocalePath(pathname: string): { segment: LocaleSegment; rest: string } | null {
  const match = LOCALE_PATH_RE.exec(pathname);
  if (!match) return null;
  const rest = pathname.slice(1 + match[1].length);
  return { segment: match[1] as LocaleSegment, rest: rest === "" ? "/" : rest };
}

/** Strip a leading /en|/zh segment; returns the input untouched when absent. */
export function stripLocalePrefix(pathname: string): string {
  const parsed = parseLocalePath(pathname);
  return parsed ? parsed.rest : pathname;
}

/** Re-prefix an internal (stripped) route path with a locale segment. */
export function buildLocalePath(segment: LocaleSegment, pathname: string): string {
  const base =
    pathname === "" || pathname === "/" ? "" : pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `/${segment}${base}`;
}

/** The locale of the current URL, read straight from window (client boot, pre-router). */
export function urlLocaleFromWindow(): SeoLocale | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = parseLocalePath(window.location.pathname);
    return parsed ? localeOfSegment(parsed.segment) : null;
  } catch {
    return null;
  }
}

let activeUrlLocale: SeoLocale = urlLocaleFromWindow() ?? "en";

/**
 * The locale of the URL the router is currently rendering. Set by the rewrite
 * input (per request/navigation) and seeded from window at module load.
 *
 * SSR caveat: this is module-scoped, so two interleaved requests with
 * different locales can transiently read each other's value in head() meta.
 * Rendered link hrefs do NOT share this problem — they use the per-router
 * closure segment in router.tsx.
 */
export function getActiveUrlLocale(): SeoLocale {
  return activeUrlLocale;
}

export function setActiveUrlLocale(locale: SeoLocale): void {
  activeUrlLocale = locale;
}

function cookieLocaleFromHeader(cookieHeader: string | null): SeoLocale | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== LOCALE_COOKIE_KEY) continue;
    const value = decodeURIComponent(part.slice(eq + 1).trim());
    return isSupportedLocaleValue(value) ? value : null;
  }
  return null;
}

/**
 * Accept-Language mapping mirrors navigatorLocale() in seo.ts: HK/TW/MO/
 * generic-zh browsers → zh-HK; mainland (zh-CN/zh-SG) stays English.
 */
function acceptLanguageLocale(header: string | null): SeoLocale {
  if (!header) return "en";
  for (const raw of header.split(",")) {
    const tag = raw.trim().toLowerCase();
    if (!tag) continue;
    if (tag.startsWith("zh")) {
      if (tag.startsWith("zh-cn") || tag.startsWith("zh-sg")) continue;
      return "zh-HK";
    }
    if (tag.startsWith("en")) return "en";
  }
  return "en";
}

/**
 * Locale an unprefixed page URL should redirect to, for the / → /en|/zh gate
 * in server.ts: saved choice (cookie) → ?hl= shareable override →
 * Accept-Language soft default → English.
 */
export function resolvePreferredLocaleForRequest(request: Request): SeoLocale {
  const url = new URL(request.url);
  const cookie = cookieLocaleFromHeader(request.headers.get("cookie"));
  if (cookie) return cookie;
  const hl = url.searchParams.get("hl");
  if (isSupportedLocaleValue(hl)) return hl;
  return acceptLanguageLocale(request.headers.get("accept-language"));
}
