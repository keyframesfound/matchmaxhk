import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import zh from "./locales/zh-HK.json";
import {
  LOCALE_COOKIE_KEY,
  LOCALE_STORAGE_KEY,
  navigatorLocale,
  readPreferredLocale,
  type SeoLocale,
} from "./seo";
import { urlLocaleFromWindow } from "./routing";

/** Persist the choice to localStorage + cookie (issue #401 acceptance). */
function persistLocale(lng: string) {
  if (typeof window === "undefined") return;
  const normalized = lng?.startsWith("zh") ? "zh-HK" : "en";
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, normalized);
  } catch {
    // Storage unavailable, cookie below may still persist.
  }
  try {
    document.cookie = `${LOCALE_COOKIE_KEY}=${encodeURIComponent(normalized)};path=/;max-age=31536000;samesite=lax`;
  } catch {
    // Cookie blocked, localStorage above may still persist.
  }
}

/**
 * The visitor landed on a /en or /zh URL different from their stored choice —
 * treat the URL as the newest expression of intent (it's now the source of
 * truth) so the next plain visit to / opens in that locale.
 */
export function persistUrlLocaleChoice(locale: SeoLocale) {
  if (typeof window === "undefined") return;
  if (readPreferredLocale() === locale) return;
  persistLocale(locale);
}

/**
 * Sync the i18n language to the URL segment (root beforeLoad, both sides).
 * Never persists: persistence flows through explicit switches (setLocale)
 * or persistUrlLocaleChoice.
 */
export function applyUrlLocale(locale: SeoLocale) {
  if (i18n.language !== locale) void i18n.changeLanguage(locale);
}

/**
 * Explicit language switch (header toggle, settings picker, account-locale
 * adoption): change the language AND persist it as the visitor's choice.
 *
 * The i18next detector's own soft result, a shared ?hl= override or a
 * navigator default, is deliberately NEVER persisted here: a blanket
 * languageChanged subscription persisted those too, so a zh-TW browser's
 * first visit (or a zh-HK user opening a shared ?hl=en link) silently
 * overwrote the stored choice (PR #433 review). Only explicit switches
 * persist.
 */
export function setLocale(lng: string) {
  void i18n.changeLanguage(lng);
  persistLocale(lng);
}

// Issue #401: custom i18next language detector. Since the 2026-10-25
// locale-prefix restructure the URL segment (/en, /zh) wins; the stored
// choice chain and the zh-TW/zh-MO → zh-HK navigator soft-default (with
// zh-CN browsers kept on English until zh-CN UI ships) only steer the
// initial / redirect and pre-router moments.
const matchmaxDetector = {
  type: "languageDetector" as const,
  async: false as const,
  init() {
    // Nothing to bootstrap, lookup helpers are pure module functions in seo.ts.
  },
  detect(): string | undefined {
    return urlLocaleFromWindow() ?? readPreferredLocale() ?? navigatorLocale();
  },
  cacheUserLanguage() {
    // Deliberately no-op: detection results (including the soft ?hl=
    // override) must not be persisted. Only setLocale() persists.
  },
};

if (!i18n.isInitialized) {
  i18n
    .use(matchmaxDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        "zh-HK": { translation: zh },
      },
      fallbackLng: "en",
      supportedLngs: ["en", "zh-HK"],
      interpolation: { escapeValue: false },
    });
}

export default i18n;
