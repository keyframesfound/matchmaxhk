import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useSwitchLocale } from "@/features/i18n/switch-locale";
import { nextLocaleInCycle, normalizeLocale, type SeoLocale } from "@/features/i18n/seo";

const SHORT_LABEL: Record<SeoLocale, string> = { en: "EN", "zh-HK": "繁", "zh-CN": "简" };
const ARIA_NAME: Record<SeoLocale, string> = {
  en: "English",
  "zh-HK": "Traditional Chinese",
  "zh-CN": "Simplified Chinese",
};

/** English is the default; 繁 and 简 are opt-in (EN → 繁 → 简 → EN). */
export function LanguageToggle() {
  const { i18n } = useTranslation();
  const switchLocale = useSwitchLocale();
  const current = normalizeLocale(i18n.language);
  const next = nextLocaleInCycle(current);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => switchLocale(next)}
      className="flex h-10 items-center gap-2 rounded-full px-3 font-bold text-[color:var(--ink)] transition-colors hover:bg-[color:var(--foreground)]/[0.06] hover:text-[color:var(--ink)]"
      aria-label={`Change language to ${ARIA_NAME[next]}`}
    >
      <Globe className="h-5 w-5" strokeWidth={2.5} />
      <span className="text-[15px]">{SHORT_LABEL[current]}</span>
    </Button>
  );
}
