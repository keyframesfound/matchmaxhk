import type { ReactNode } from "react";
import { Monitor } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { OptionCard, OptionCardGroup } from "@/features/settings/option-card";
import type { ThemePreference } from "@/features/theme/ThemeProvider";

/**
 * Miniature of a MatchMax directory page in each palette, hardcoded from the
 * design tokens so a card always shows its own theme even while another is
 * active (theme vars alone can't show the "other" mode).
 */
function ThemeMiniature({ dark }: { dark: boolean }) {
  const canvas = dark ? "#121212" : "#FFFFFF";
  const surface = dark ? "#1E1E1E" : "#F7F8F8";
  const line = dark ? "#2E3033" : "#E1EAEF";
  const ink = dark ? "#9BA1A6" : "#536471";
  const azure = "#1D9BF0";
  return (
    <div
      aria-hidden
      className="h-[64px] w-full min-w-0 rounded-lg border p-1.5"
      style={{ backgroundColor: canvas, borderColor: line }}
    >
      <div className="flex min-w-0 items-center gap-1">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: azure }} />
        <span className="h-1 w-4 shrink-0 rounded-full" style={{ backgroundColor: ink }} />
        <span className="h-1 w-3 shrink-0 rounded-full" style={{ backgroundColor: line }} />
        <span className="h-1 w-3 shrink-0 rounded-full" style={{ backgroundColor: line }} />
      </div>
      <div
        className="mt-1 min-w-0 rounded-md border p-1"
        style={{ backgroundColor: surface, borderColor: line }}
      >
        <div className="flex min-w-0 items-center gap-1">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: azure, opacity: 0.4 }}
          />
          <span className="h-1 w-6 shrink-0 rounded-full" style={{ backgroundColor: ink }} />
          <span
            className="ml-auto h-2 w-4 shrink-0 rounded-full"
            style={{ backgroundColor: azure }}
          />
        </div>
        <span className="mt-0.5 block h-1 w-8 rounded-full" style={{ backgroundColor: line }} />
      </div>
    </div>
  );
}

export function ThemeModeCards({
  theme,
  onPick,
  disabled,
}: {
  theme: ThemePreference;
  onPick: (theme: ThemePreference) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const options: {
    value: ThemePreference;
    label: string;
    description: string;
    preview: ReactNode;
  }[] = [
    {
      value: "system",
      label: t("settings.general.theme_system"),
      description: t("settings.general.theme_system_desc"),
      preview: <Monitor className="h-5 w-5 text-[color:var(--ink)]" aria-hidden="true" />,
    },
    {
      value: "light",
      label: t("settings.general.theme_light"),
      description: t("settings.general.theme_light_desc"),
      preview: <ThemeMiniature dark={false} />,
    },
    {
      value: "dark",
      label: t("settings.general.theme_dark"),
      description: t("settings.general.theme_dark_desc"),
      preview: <ThemeMiniature dark />,
    },
  ];

  return (
    <OptionCardGroup label={t("settings.general.color_mode")}>
      {options.map((option) => (
        <OptionCard
          key={option.value}
          selected={theme === option.value}
          onSelect={() => onPick(option.value)}
          label={option.label}
          description={option.description}
          disabled={disabled}
          badge={
            option.value === "dark" ? (
              <Badge variant="destructive" className="px-1.5 py-0 text-[10px] font-bold leading-5">
                Beta
              </Badge>
            ) : undefined
          }
          preview={
            option.value === "system" ? (
              <div className="flex w-full gap-1.5">
                <ThemeMiniature dark={false} />
                <ThemeMiniature dark />
              </div>
            ) : (
              option.preview
            )
          }
        />
      ))}
    </OptionCardGroup>
  );
}
