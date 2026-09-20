import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SettingsCard } from "@/features/settings/option-card";
import type { SettingsSectionProps } from "@/features/settings/types";
import { sanitizeNotificationPrefs } from "@/features/settings/types";
import { useTheme } from "@/features/theme/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";

/** Keys this browser caches for MatchMax that the clear action wipes. */
const LOCAL_STORAGE_KEYS = ["matchmax:compared-cases"];
const SESSION_STORAGE_PREFIXES = ["matchmax.draft."];
const SESSION_STORAGE_KEYS = ["mm_banner_dismissed_session_v1"];

export function PrivacySection({ user, profile }: SettingsSectionProps) {
  const { t } = useTranslation("settings");
  const { theme } = useTheme();
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function exportData() {
    setExporting(true);
    try {
      const [savedTutors, savedCases, savedCourses] = await Promise.all([
        supabase.from("saved_tutors").select("*").eq("user_id", user.id),
        supabase.from("saved_cases").select("*").eq("user_id", user.id),
        supabase.from("saved_courses").select("*").eq("user_id", user.id),
      ]);
      const payload = {
        exported_at: new Date().toISOString(),
        account: {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          sign_in_provider: user.app_metadata?.provider ?? "email",
        },
        profile: profile ?? null,
        notification_preferences: profile
          ? sanitizeNotificationPrefs(profile.notification_preferences)
          : null,
        theme_preference: theme,
        saved_tutors: savedTutors.data ?? [],
        saved_cases: savedCases.data ?? [],
        saved_courses: savedCourses.data ?? [],
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "matchmax-data-export.json";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("privacy.export_error"));
    } finally {
      setExporting(false);
    }
  }

  function clearLocalData() {
    setClearing(true);
    try {
      for (const key of LOCAL_STORAGE_KEYS) window.localStorage.removeItem(key);
      for (const key of SESSION_STORAGE_KEYS) window.sessionStorage.removeItem(key);
      for (const prefix of SESSION_STORAGE_PREFIXES) {
        for (let i = window.sessionStorage.length - 1; i >= 0; i -= 1) {
          const key = window.sessionStorage.key(i);
          if (key?.startsWith(prefix)) window.sessionStorage.removeItem(key);
        }
      }
      toast.success(t("privacy.local_cleared"));
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-6">
      <SettingsCard title={t("privacy.export_title")} description={t("privacy.export_desc")}>
        <Button
          type="button"
          variant="outline"
          onClick={() => void exportData()}
          disabled={exporting}
          className="border-[color:var(--ink)]/15 font-bold text-[color:var(--ink)] hover:bg-[color:var(--ink)]/5"
        >
          {exporting ? t("privacy.exporting") : t("privacy.export_button")}
        </Button>
      </SettingsCard>

      <SettingsCard title={t("privacy.local_title")} description={t("privacy.local_desc")}>
        <Button
          type="button"
          variant="outline"
          onClick={clearLocalData}
          disabled={clearing}
          className="border-[color:var(--ink)]/15 font-bold text-[color:var(--ink)] hover:bg-[color:var(--ink)]/5"
        >
          {t("privacy.local_button")}
        </Button>
      </SettingsCard>

      <p className="text-sm">
        <Link
          to="/privacy-policy"
          className="font-semibold text-[color:var(--ink)] underline underline-offset-2"
        >
          {t("privacy.policy_link")}
        </Link>
      </p>
    </div>
  );
}
