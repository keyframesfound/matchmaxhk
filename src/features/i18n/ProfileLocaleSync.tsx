import { useEffect, useRef } from "react";

import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import i18n from "@/features/i18n/config";
import { readPreferredLocale } from "@/features/i18n/seo";
import { useSwitchLocale } from "@/features/i18n/switch-locale";

const SUPPORTED_LOCALES = ["en", "zh-HK"] as const;

/**
 * Adopts the account-level language once per signed-in user, mirroring how
 * ThemeProvider adopts profiles.theme_preference. Device choice wins until
 * the profile says otherwise on a fresh browser: an explicit toggle (cookie/
 * localStorage via useSwitchLocale, or ?hl=) must never be reverted here, or
 * the header language toggle would bounce back on the next page load.
 */
export function ProfileLocaleSync() {
  const { user } = useAuth();
  const switchLocale = useSwitchLocale();
  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      syncedFor.current = null;
      return;
    }
    if (syncedFor.current === user.id) return;
    syncedFor.current = user.id;
    let active = true;
    void supabase
      .from("profiles")
      .select("locale")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const locale = data?.locale;
        if (
          typeof locale === "string" &&
          (SUPPORTED_LOCALES as readonly string[]).includes(locale) &&
          i18n.language !== locale &&
          // No explicit device choice (?hl=, localStorage, cookie) — a
          // visitor who toggled the language deliberately keeps it.
          !readPreferredLocale()
        ) {
          switchLocale(locale);
        }
      });
    return () => {
      active = false;
    };
  }, [user, switchLocale]);

  return null;
}
