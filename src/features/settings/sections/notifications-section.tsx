import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SettingsCard } from "@/features/settings/option-card";
import {
  sanitizeNotificationPrefs,
  type NotificationPrefs,
  type SettingsSectionProps,
} from "@/features/settings/types";
import { useAuth } from "@/features/auth/useAuth";

export function NotificationsSection({ profile, updateProfile }: SettingsSectionProps) {
  const { t } = useTranslation();
  const { hasRole } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);

  useEffect(() => {
    if (profile) setPrefs(sanitizeNotificationPrefs(profile.notification_preferences));
  }, [profile]);

  async function togglePref(key: keyof NotificationPrefs, next: boolean) {
    if (!prefs) return;
    const optimistic: NotificationPrefs = { ...prefs, [key]: next };
    setPrefs(optimistic);
    const ok = await updateProfile({ notification_preferences: optimistic });
    if (!ok) {
      setPrefs(prefs);
      toast.error(t("settings.notifications.save_error"));
      return;
    }
    toast.success(t("settings.notifications.saved"));
  }

  const rows: {
    key: keyof NotificationPrefs;
    titleKey: string;
    descKey: string;
  }[] = [
    {
      key: "case_updates",
      titleKey: "settings.notifications.case_updates",
      descKey: "settings.notifications.case_updates_desc",
    },
    {
      key: "match_suggestions",
      titleKey: "settings.notifications.match_suggestions",
      descKey: "settings.notifications.match_suggestions_desc",
    },
    ...(hasRole("tutor")
      ? [
          {
            key: "tutor_leads" as const,
            titleKey: "settings.notifications.tutor_leads",
            descKey: "settings.notifications.tutor_leads_desc",
          },
        ]
      : []),
    {
      key: "product_news",
      titleKey: "settings.notifications.product_news",
      descKey: "settings.notifications.product_news_desc",
    },
  ];

  return (
    <SettingsCard
      title={t("settings.notifications.title")}
      description={t("settings.notifications.description")}
    >
      <p className="mb-5 rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] px-4 py-3 text-xs leading-5 text-[color:var(--ink)]/65">
        {t("settings.notifications.hint")}
      </p>
      {prefs ? (
        <div className="divide-y divide-[color:var(--ink)]/10">
          {rows.map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between gap-6 py-4 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <Label
                  htmlFor={`notif-${row.key}`}
                  className="text-sm font-bold text-[color:var(--ink)]"
                >
                  {t(row.titleKey)}
                </Label>
                <p className="mt-0.5 text-xs leading-5 text-[color:var(--ink)]/60">
                  {t(row.descKey)}
                </p>
              </div>
              <Switch
                id={`notif-${row.key}`}
                checked={prefs[row.key]}
                onCheckedChange={(checked) => void togglePref(row.key, checked)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4" aria-hidden>
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-10 animate-pulse rounded-xl bg-[color:var(--ink)]/5" />
          ))}
        </div>
      )}
    </SettingsCard>
  );
}
