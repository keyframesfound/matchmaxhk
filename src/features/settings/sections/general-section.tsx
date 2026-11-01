import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { SettingsCard, OptionCard, OptionCardGroup } from "@/features/settings/option-card";
import { useSwitchLocale } from "@/features/i18n/switch-locale";
import { normalizeLocale } from "@/features/i18n/seo";
import { ThemeModeCards } from "@/features/settings/theme-mode-cards";
import type { SettingsSectionProps } from "@/features/settings/types";
import { useTheme, type ThemePreference } from "@/features/theme/ThemeProvider";

const LOCALE_OPTIONS = [
  {
    value: "en",
    labelKey: "settings.general.language_en",
    descKey: "settings.general.language_en_desc",
  },
  {
    value: "zh-HK",
    labelKey: "settings.general.language_zh",
    descKey: "settings.general.language_zh_desc",
  },
  {
    value: "zh-CN",
    labelKey: "settings.general.language_zh_cn",
    descKey: "settings.general.language_zh_cn_desc",
  },
] as const;

export function GeneralSection({ profile, updateProfile }: SettingsSectionProps) {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const switchLocale = useSwitchLocale();
  const currentLocale = normalizeLocale(i18n.language);

  function pickLocale(locale: string) {
    if (locale === currentLocale) return;
    switchLocale(locale);
    void updateProfile({ locale }).then((ok) => {
      if (ok) toast.success(t("settings.general.language_saved"));
    });
  }

  return (
    <div className="space-y-6">
      <SettingsCard
        title={t("settings.general.appearance_title")}
        description={t("settings.general.appearance_desc")}
      >
        <p className="mb-3 text-sm font-bold text-[color:var(--ink)]">
          {t("settings.general.color_mode")}
        </p>
        <ThemeModeCards theme={theme} onPick={(next: ThemePreference) => setTheme(next)} />
      </SettingsCard>

      <SettingsCard
        title={t("settings.general.language_title")}
        description={t("settings.general.language_desc")}
      >
        <OptionCardGroup label={t("settings.general.language_title")} columns={3}>
          {LOCALE_OPTIONS.map((option) => (
            <OptionCard
              key={option.value}
              selected={currentLocale === option.value}
              onSelect={() => pickLocale(option.value)}
              label={t(option.labelKey)}
              description={t(option.descKey)}
              preview={
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--primary)]/10 text-base font-bold text-[color:var(--primary)]">
                  {option.value === "en" ? "En" : option.value === "zh-HK" ? "繁" : "简"}
                </span>
              }
            />
          ))}
        </OptionCardGroup>
      </SettingsCard>
      {/* #522: strictly private DOB; powers age tiers + the optional
          month/day birthday badge. */}
      <SettingsCard
        title={t("settings.general.dob_title")}
        description={t("settings.general.dob_desc")}
      >
        <label className="block text-sm font-bold text-[color:var(--ink)]" htmlFor="dob-input">
          {t("settings.general.dob_label")}
        </label>
        <input
          id="dob-input"
          type="date"
          max={new Date().toISOString().slice(0, 10)}
          defaultValue={profile?.date_of_birth ?? ""}
          onBlur={(event) => {
            const next = event.target.value || null;
            if (next === (profile?.date_of_birth ?? null)) return;
            void updateProfile({ date_of_birth: next }).then((ok) => {
              if (ok) toast.success(t("settings.general.dob_saved"));
            });
          }}
          className="mt-2 h-10 rounded-xl border border-border bg-[color:var(--surface)] px-3 text-sm"
        />
      </SettingsCard>
    </div>
  );
}
