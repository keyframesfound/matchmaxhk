import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import zh from "./locales/zh-HK.json";
import { LOCALE_COOKIE_KEY, LOCALE_STORAGE_KEY, navigatorLocale, readPreferredLocale } from "./seo";

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

// Issue #401: custom i18next language detector, the built-in
// i18next-browser-languagedetector can't map zh-TW/zh-MO/generic-zh onto
// zh-HK while keeping deferred zh-CN browsers on English, and we need cookie
// persistence alongside localStorage plus a soft ?hl= override for
// shareable links. Soft defaults only: switching to English is always one tap.
const matchmaxDetector = {
  type: "languageDetector" as const,
  async: false as const,
  init() {
    // Nothing to bootstrap, lookup helpers are pure module functions in seo.ts.
  },
  detect(): string | undefined {
    return readPreferredLocale() ?? navigatorLocale();
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
