import { formatDistanceToNow } from "date-fns";
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
    locale: locale === "zh-HK" ? zhHK : undefined,
  });
}
