import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { SettingsCard, OptionCard, OptionCardGroup } from "@/features/settings/option-card";
import { ThemeModeCards } from "@/features/settings/theme-mode-cards";
import type { SettingsSectionProps } from "@/features/settings/types";
import { useTheme, type ThemePreference } from "@/features/theme/ThemeProvider";

const LOCALE_OPTIONS = [
  { value: "en", labelKey: "general.language_en", descKey: "general.language_en_desc" },
  { value: "zh-HK", labelKey: "general.language_zh", descKey: "general.language_zh_desc" },
] as const;

export function GeneralSection({ profile, updateProfile }: SettingsSectionProps) {
  const { t, i18n } = useTranslation("settings");
  const { theme, setTheme } = useTheme();
  const currentLocale = i18n.language?.startsWith("zh") ? "zh-HK" : "en";

  function pickLocale(locale: string) {
    if (locale === currentLocale) return;
    void i18n.changeLanguage(locale);
    void updateProfile({ locale }).then((ok) => {
      if (ok) toast.success(t("general.language_saved"));
    });
  }

  return (
    <div className="space-y-6">
      <SettingsCard
        title={t("general.appearance_title")}
        description={t("general.appearance_desc")}
      >
        <p className="mb-3 text-sm font-bold text-[color:var(--ink)]">{t("general.color_mode")}</p>
        <ThemeModeCards theme={theme} onPick={(next: ThemePreference) => setTheme(next)} />
      </SettingsCard>

      <SettingsCard title={t("general.language_title")} description={t("general.language_desc")}>
        <OptionCardGroup label={t("general.language_title")} columns={2}>
          {LOCALE_OPTIONS.map((option) => (
            <OptionCard
              key={option.value}
              selected={currentLocale === option.value}
              onSelect={() => pickLocale(option.value)}
              label={t(option.labelKey)}
              description={t(option.descKey)}
              preview={
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--primary)]/10 text-base font-bold text-[color:var(--primary)]">
                  {option.value === "en" ? "En" : "繁"}
                </span>
              }
            />
          ))}
        </OptionCardGroup>
      </SettingsCard>
    </div>
  );
}
