import { useTranslation } from "react-i18next";

import i18n from "@/features/i18n/config";

import { type SenCategory } from "./sen";

/**
 * Issue #199: display labels for the stored SEN category vocabulary
 * (src/features/tutors/sen.ts). The stored values are DATA — they appear in
 * tutors.sen_categories / tutoring_cases.sen_categories and never change;
 * labels localize through these literal i18n keys (sen.category.* in
 * src/features/i18n/locales/{en,zh-HK}.json). Keep keys literal so the
 * eslint i18n guard and scripts/check-i18n.mjs can verify them.
 */
const SEN_CATEGORY_LABEL_KEYS: Record<SenCategory, string> = {
  ADHD: "sen.category.adhd",
  ASD: "sen.category.asd",
  "Dyslexia/SpLD": "sen.category.dyslexia",
  Dyspraxia: "sen.category.dyspraxia",
  "Speech & Language Impairment": "sen.category.speech",
  Other: "sen.category.other",
};

/**
 * Translated label for one stored category. Module-level (non-hook) variant
 * for pure helpers such as case-pills; reads the active language at call time.
 * Unknown values pass through unchanged.
 */
export function senCategoryLabel(category: string): string {
  const key = SEN_CATEGORY_LABEL_KEYS[category as SenCategory];
  return key ? i18n.t(key) : category;
}

/** Component-side label map: stored category -> translated label. */
export function useSenCategoryLabels(): Record<SenCategory, string> {
  const { t } = useTranslation();
  return {
    ADHD: t("sen.category.adhd"),
    ASD: t("sen.category.asd"),
    "Dyslexia/SpLD": t("sen.category.dyslexia"),
    Dyspraxia: t("sen.category.dyspraxia"),
    "Speech & Language Impairment": t("sen.category.speech"),
    Other: t("sen.category.other"),
  };
}
