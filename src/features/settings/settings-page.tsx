import { useCallback, useEffect, useMemo, type ComponentType } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Bookmark,
  CalendarClock,
  CircleUserRound,
  Database,
  Gift,
  GraduationCap,
  KeyRound,
  LogOut,
  Settings2,
  Trash2,
  UserCog,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { useAuth } from "@/features/auth/useAuth";
import { SuggestedActionsSection } from "@/features/dashboard/action-cards";
import { AccountSection } from "@/features/settings/sections/account-section";
import { AvailabilitySection } from "@/features/settings/sections/availability-section";
import { AvailabilityGridEditor } from "@/features/settings/sections/availability-grid-editor";
import { DangerZoneSection } from "@/features/settings/sections/danger-zone-section";
import { GeneralSection } from "@/features/settings/sections/general-section";
import { MyTutorProfileSection } from "@/features/settings/sections/my-tutor-profile-section";
import { NotificationsSection } from "@/features/settings/sections/notifications-section";
import { PrivacySection } from "@/features/settings/sections/privacy-section";
import { ProfileSection } from "@/features/settings/sections/profile-section";
import { ReferralsSection } from "@/features/settings/sections/referrals-section";
import { SecuritySection } from "@/features/settings/sections/security-section";
import {
  categoryFromHash,
  type SettingsCategory,
  type SettingsProfile,
  type SettingsProfileUpdate,
  type SettingsSectionProps,
} from "@/features/settings/types";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const CATEGORY_META: Record<SettingsCategory, { labelKey: string; icon: typeof Settings2 }> = {
  general: { labelKey: "settings.nav.general", icon: Settings2 },
  profile: { labelKey: "settings.nav.profile", icon: CircleUserRound },
  "my-tutor": { labelKey: "settings.nav.my_tutor", icon: GraduationCap },
  availability: { labelKey: "settings.nav.availability", icon: CalendarClock },
  account: { labelKey: "settings.nav.account", icon: UserCog },
  security: { labelKey: "settings.nav.security", icon: KeyRound },
  notifications: { labelKey: "settings.nav.notifications", icon: Bell },
  referrals: { labelKey: "settings.nav.referrals", icon: Gift },
  privacy: { labelKey: "settings.nav.privacy", icon: Database },
  "danger-zone": { labelKey: "settings.nav.danger", icon: Trash2 },
};

/**
 * Issue #116: the Availability tab holds the existing start-date/capacity card
 * plus the new self-serve weekly availability grid beneath it.
 */
function AvailabilityTab(_props: SettingsSectionProps) {
  return (
    <div className="space-y-6">
      {/* AvailabilitySection takes no props (it reads auth + queries itself). */}
      <AvailabilitySection />
      <AvailabilityGridEditor />
    </div>
  );
}

const SECTION_COMPONENTS: Record<SettingsCategory, ComponentType<SettingsSectionProps>> = {
  general: GeneralSection,
  profile: ProfileSection,
  "my-tutor": MyTutorProfileSection,
  availability: AvailabilityTab,
  account: AccountSection,
  security: SecuritySection,
  notifications: NotificationsSection,
  referrals: ReferralsSection,
  privacy: PrivacySection,
  "danger-zone": DangerZoneSection,
};

export function SettingsPage() {
  const { t } = useTranslation();
  const { user, signOut, hasAnyRole, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const activeCategory = categoryFromHash(location.hash);
  const isInternal = hasAnyRole(["admin", "staff", "super_admin"]);

  const userId = user?.id;

  // The referral program is tutor-only: the tab appears once the signed-in
  // account is linked to a tutor card (tutors.user_id, set by admins).
  const tutorLinkQuery = useQuery({
    queryKey: ["settings", "tutor-link", userId],
    queryFn: async () => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("tutors")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string } | null;
    },
    enabled: Boolean(userId),
  });
  const hasLinkedTutor = Boolean(tutorLinkQuery.data);

  const categories = useMemo(() => {
    const all = Object.keys(CATEGORY_META) as SettingsCategory[];
    return all.filter((category) => {
      if (category === "account" && isInternal) return false;
      // Availability, referrals and my-tutor are tutor-only: all need the
      // signed-in account to be linked to a tutor card (tutors.user_id,
      // set by admins in the editor's Assigned Account section).
      if (category === "availability" || category === "referrals" || category === "my-tutor") {
        return hasLinkedTutor;
      }
      return true;
    });
  }, [isInternal, hasLinkedTutor]);

  const profileQuery = useQuery({
    queryKey: ["settings", "profile", userId],
    queryFn: async () => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, phone, locale, notification_preferences, tos_accepted_at")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data as SettingsProfile;
    },
    enabled: Boolean(userId),
  });

  useEffect(() => {
    if (profileQuery.isError) {
      toast.error(t("settings.load_error"));
    }
  }, [profileQuery.isError, t]);

  const updateProfile = useCallback(
    async (fields: SettingsProfileUpdate) => {
      if (!userId) return false;
      const { error } = await supabase.from("profiles").update(fields).eq("id", userId);
      if (error) {
        toast.error(error.message);
        return false;
      }
      await queryClient.invalidateQueries({ queryKey: ["settings", "profile", userId] });
      return true;
    },
    [queryClient, userId],
  );

  // Switching category swaps the whole content pane — always start at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeCategory]);

  if (!user) return null;

  const sectionProps: SettingsSectionProps = {
    user,
    profile: profileQuery.data,
    updateProfile,
  };
  const ActiveSection = SECTION_COMPONENTS[activeCategory];

  const navButtonClass = (active: boolean) =>
    cn(
      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
      active
        ? "bg-[color:var(--ink)]/5 font-semibold text-[color:var(--ink)]"
        : "font-medium text-[color:var(--ink)]/70 hover:bg-[color:var(--ink)]/5 hover:text-[color:var(--ink)]",
    );

  function selectCategory(category: SettingsCategory) {
    if (category === activeCategory) return;
    void navigate({ to: "/dashboard", hash: category });
  }

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--surface-subtle)] text-[color:var(--ink)]">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <header className="border-b border-[color:var(--ink)]/10 pb-8">
            <p className="text-xs font-medium text-[color:var(--ink)]/65">
              {t("settings.eyebrow")}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[color:var(--ink)] sm:text-4xl">
              {t("settings.title")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--ink)]/70">
              {t("settings.subtitle")}
            </p>
          </header>

          <div className="grid gap-6 pt-8 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-14 lg:pt-10">
            <div className="min-w-0 lg:col-span-2 lg:max-w-3xl">
              {/* Issue #147: suggested-action cards switch on account type. */}
              <SuggestedActionsSection isTutor={hasRole("tutor") || hasLinkedTutor} />
            </div>
          </div>

          <div className="grid gap-6 pt-8 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-14 lg:pt-10">
            {/* min-w-0: without it the grid track stretches to the pills row's
                max-content width, widening the whole page on mobile (#146). */}
            <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
              {/* Mobile: horizontally scrollable category pills */}
              <nav
                aria-label={t("settings.title")}
                className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden"
              >
                {categories.map((category) => {
                  const { labelKey, icon: Icon } = CATEGORY_META[category];
                  const active = category === activeCategory;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => selectCategory(category)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
                        active
                          ? "border-[color:var(--ink)]/20 bg-[color:var(--ink)]/5 font-bold text-[color:var(--ink)]"
                          : "border-[color:var(--ink)]/10 bg-[color:var(--surface)] font-medium text-[color:var(--ink)]/65 hover:bg-[color:var(--ink)]/5",
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {t(labelKey)}
                    </button>
                  );
                })}
              </nav>

              {/* Desktop: sidebar category list */}
              <nav className="hidden space-y-1 lg:block" aria-label={t("settings.title")}>
                <Link
                  to="/saved-posts"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[color:var(--ink)]/70 transition-colors hover:bg-[color:var(--ink)]/5 hover:text-[color:var(--ink)]"
                >
                  <Bookmark className="h-4 w-4" aria-hidden="true" />
                  {t("settings.nav.saved_posts")}
                </Link>
                <div className="my-2 border-t border-[color:var(--ink)]/10" aria-hidden />
                {categories.map((category) => {
                  const { labelKey, icon: Icon } = CATEGORY_META[category];
                  const active = category === activeCategory;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => selectCategory(category)}
                      aria-current={active ? "true" : undefined}
                      className={cn("w-full text-left", navButtonClass(active))}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {t(labelKey)}
                    </button>
                  );
                })}
                <div className="my-2 border-t border-[color:var(--ink)]/10" aria-hidden />
                <Button
                  variant="outline"
                  onClick={() => void signOut()}
                  className="w-full justify-start gap-2 border-[color:var(--ink)]/15 text-sm font-semibold text-[color:var(--ink)] hover:bg-[color:var(--destructive)]/10 hover:text-[color:var(--destructive)]"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  {t("settings.nav.sign_out")}
                </Button>
              </nav>
            </aside>

            <div className="min-w-0 max-w-3xl">
              <ActiveSection {...sectionProps} />
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
