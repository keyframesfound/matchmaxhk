/**
 * Issue #411 — display precedence for the dual-language custom headline.
 * Pure so the card, the detail page and vitest share one rule set:
 * - en (default): custom_headline_en ?? academic_headline
 * - zh-* (only zh-HK ships in this app): custom_headline_zh ??
 *   custom_headline_en ?? academic_headline
 * Empty/whitespace-only values fall back strictly. Whatever renders is
 * exactly what the tutor saved — never a machine translation (CEO lock).
 */

export type CustomHeadlineSource = {
  custom_headline_en?: string | null;
  custom_headline_zh?: string | null;
  academic_headline?: string | null;
};

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

export function getActiveCustomHeadline(
  tutor: CustomHeadlineSource,
  locale: string | null | undefined,
): string | null {
  const en = nonEmpty(tutor.custom_headline_en);
  const zh = nonEmpty(tutor.custom_headline_zh);
  const derived = nonEmpty(tutor.academic_headline);
  if ((locale ?? "").trim().toLowerCase().startsWith("zh")) {
    return zh ?? en ?? derived;
  }
  return en ?? derived;
}

export const MAX_CUSTOM_HEADLINE = 60;
