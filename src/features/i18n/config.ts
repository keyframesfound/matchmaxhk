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
    // Storage unavailable — cookie below may still persist.
  }
  try {
    document.cookie = `${LOCALE_COOKIE_KEY}=${encodeURIComponent(normalized)};path=/;max-age=31536000;samesite=lax`;
  } catch {
    // Cookie blocked — localStorage above may still persist.
  }
}

// Issue #401: custom i18next language detector — the built-in
// i18next-browser-languagedetector can't map zh-TW/zh-MO/generic-zh onto
// zh-HK while keeping deferred zh-CN browsers on English, and we need cookie
// persistence alongside localStorage plus a soft ?hl= override for
// shareable links. Soft defaults only: switching to English is always one tap.
const matchmaxDetector = {
  type: "languageDetector" as const,
  async: false as const,
  init() {
    // Nothing to bootstrap — lookup helpers are pure module functions in seo.ts.
  },
  detect(): string | undefined {
    return readPreferredLocale() ?? navigatorLocale();
  },
  cacheUserLanguage() {
    // Persistence runs in the languageChanged listener below instead — it
    // also covers changeLanguage calls from ProfileLocaleSync and the toggle.
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

  i18n.on("languageChanged", (lng) => {
    if (lng) persistLocale(lng);
  });
}

export default i18n;
