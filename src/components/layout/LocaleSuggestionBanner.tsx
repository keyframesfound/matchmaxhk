import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { Languages, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  localeSuggestion,
  persistSuggestionDismissed,
  readSuggestionDismissed,
} from "@/features/i18n/locale-suggestion";
import { getActiveUrlLocale } from "@/features/i18n/routing";
import { readPreferredLocale, type SeoLocale } from "@/features/i18n/seo";
import { useSwitchLocale } from "@/features/i18n/switch-locale";

/**
 * Offers a Chinese-language browser its variant on English pages. Computed
 * in an effect so SSR (and every crawler) renders nothing, and the copy is
 * shown in the suggested language, the one the visitor actually reads.
 */
export function LocaleSuggestionBanner() {
  const { i18n } = useTranslation();
  const location = useLocation();
  const switchLocale = useSwitchLocale();
  const [suggested, setSuggested] = useState<SeoLocale | null>(null);

  useEffect(() => {
    setSuggested(
      localeSuggestion({
        urlLocale: getActiveUrlLocale(),
        preferred: readPreferredLocale(),
        dismissed: readSuggestionDismissed(),
        languages: [...(navigator.languages ?? []), navigator.language].filter(Boolean),
      }),
    );
    // The router pathname is locale-stripped (/zh/tutors reads as /tutors),
    // so the language is a dependency too: a switch must re-evaluate.
  }, [location.pathname, i18n.language]);

  if (!suggested) return null;

  const t = i18n.getFixedT(suggested);
  const dismiss = () => {
    persistSuggestionDismissed();
    setSuggested(null);
  };

  return (
    <div
      role="region"
      aria-label={t("locale_suggestion.prompt")}
      lang={suggested}
      className="border-b border-[color:var(--foreground)]/10 bg-[color:var(--foreground)]/[0.04]"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
        <Languages className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm text-[color:var(--ink)]">
          {t("locale_suggestion.prompt")}
        </p>
        <button
          type="button"
          onClick={() => {
            persistSuggestionDismissed();
            setSuggested(null);
            switchLocale(suggested);
          }}
          className="rounded-full bg-[color:var(--ink)] px-3 py-1.5 text-sm font-bold text-[color:var(--background)] hover:opacity-90"
        >
          {t("locale_suggestion.switch")}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("locale_suggestion.dismiss")}
          className="rounded p-1 text-muted-foreground hover:text-[color:var(--ink)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
