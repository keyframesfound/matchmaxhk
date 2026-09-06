import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith("zh") ? "zh-HK" : "en";
  const next = current === "en" ? "zh-HK" : "en";

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => i18n.changeLanguage(next)}
      className="flex h-10 items-center gap-2 rounded-full px-3 font-bold text-[color:var(--ink)] transition-colors hover:bg-[color:var(--foreground)]/[0.06] hover:text-[color:var(--ink)]"
      aria-label={`Change language to ${next === "en" ? "English" : "Traditional Chinese"}`}
    >
      <Globe className="h-5 w-5" strokeWidth={2.5} />
      <span className="text-[15px]">{current === "en" ? "EN" : "繁"}</span>
    </Button>
  );
}
