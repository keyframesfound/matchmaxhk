import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith("zh") ? "zh-HK" : "en";
  const next = current === "en" ? "zh-HK" : "en";

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => i18n.changeLanguage(next)}
      className="h-9 px-3 text-xs font-bold"
      aria-label="Change language"
    >
      {current === "en" ? "EN / 繁" : "繁 / EN"}
    </Button>
  );
}
