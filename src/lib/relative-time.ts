import { formatDistanceToNow, type Locale } from "date-fns";
import { zhHK } from "date-fns/locale";

/**
 * Locale-aware "x ago" for public case surfaces (#384-class zh gap, GLM
 * round-3 minor on #430): date-fns ships a zh-HK locale, so relative times
 * no longer render English ("2 days ago") for zh-HK visitors. Callers pass
 * i18n.language; unknown locales fall back to date-fns' default (en).
 *
 * Admin surfaces keep plain formatDistanceToNow — the admin desk is
 * English-only by convention.
 */
export function formatPostedAgo(date: string | number | Date, locale?: string): string {
  return formatDistanceToNow(new Date(date), {
    addSuffix: true,
    locale: dateFnsLocale(locale),
  });
}

/**
 * The date-fns Locale for an i18n language code — undefined falls back to
 * date-fns' English default. Pass this into format()/formatDistanceToNow
 * options so day/month names follow the app locale (tutor-facing surfaces).
 */
export function dateFnsLocale(language: string | null | undefined): Locale | undefined {
  return language === "zh-HK" ? zhHK : undefined;
}
