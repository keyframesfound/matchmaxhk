import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Activity,
  Wallet,
  BellRing,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  Gift,
  Globe,
  Lock,
  LogIn,
  LogOut,
  Moon,
  Repeat,
  Scale,
  Settings,
  ShieldCheck,
  Sun,
  UserRound,
  UserRoundPlus,
} from "lucide-react";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { LanguageToggle } from "@/components/brand/LanguageToggle";
import { CurrencyToggle } from "@/components/brand/CurrencyToggle";
import { Button } from "@/components/ui/button";
import { InitialAvatar } from "@/components/ui/initial-avatar";
import {
  PREVIEW_OWNER_COLUMNS,
  resolvePreviewCardState,
  type PreviewOwnerRow,
} from "@/features/account/preview/preview-state";
import { useAuth } from "@/features/auth/useAuth";
import { useMyOrganization } from "@/features/business/useMyOrganization";
import { useTheme } from "@/features/theme/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { CENTRE_MARKET_ENABLED } from "@/lib/feature-flags";

/**
 * #594 CEO lock (2026-11-04): the Phone Account hub (Airbnb Profile
 * pattern). The bottom Account tab opens this page; the top-right phone
 * hamburger is gone, so everything that lived there is one thumb away
 * here: profile header, Become a Tutor card (or the Learning / Teaching
 * switch), and rows for Guide · Manage · Help · Settings · View profile ·
 * Privacy · Notifications · Refer a tutor · Legal · Dark mode · Language ·
 * Admin · Sign out.
 */
export const Route = createFileRoute("/me")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Account | MatchMax" }, { name: "robots", content: "noindex" }],
  }),
  component: AccountHubPage,
});

const rowClass =
  "flex w-full items-center gap-3.5 px-1 py-3.5 text-[15px] font-medium text-[color:var(--ink)] transition-colors hover:text-[color:var(--ink)]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function RowContent({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[color:var(--ink)]">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-left">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </>
  );
}

/**
 * #793 AC-594-HUB-2: "View profile" opens the user's PUBLIC profile, not the
 * account editor — a signed-in user pressing it wants to see what everyone else
 * sees. Order of preference, using only routes that already exist:
 *
 *   1. a live tutor card        → /tutors/{tutor_code}  (the URL the profile's
 *                                 own Share control sends)
 *   2. a channel handle         → /u/{handle}
 *   3. neither                  → /account (the editor), the documented
 *                                 fallback, which Settings still reaches
 *
 * The live/not-live decision is `resolvePreviewCardState`, the same rule the
 * "Preview as parent" sandbox uses, so "live" cannot mean two different things.
 */
function ProfileLink({ className, children }: { className?: string; children: ReactNode }) {
  const { user } = useAuth();
  const owner = useQuery({
    queryKey: ["account", "hub-owner-row", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutors")
        .select(PREVIEW_OWNER_COLUMNS)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as PreviewOwnerRow) ?? null;
    },
  });
  const handle = useQuery({
    queryKey: ["account", "hub-handle", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("handle")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as { handle: string | null } | null)?.handle?.trim() || null;
    },
  });

  const state = resolvePreviewCardState(owner.data ?? null);
  if (state.status === "live") {
    return (
      <Link to="/tutors/$tutorCode" params={{ tutorCode: state.tutorCode }} className={className}>
        {children}
      </Link>
    );
  }
  if (handle.data) {
    return (
      <Link to="/u/$handle" params={{ handle: handle.data }} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <Link to="/account" className={className}>
      {children}
    </Link>
  );
}

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      {title ? <h2 className="mb-1 text-xs font-semibold text-muted-foreground">{title}</h2> : null}
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function AccountHubPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, signOut, hasAnyRole, hasRole, activeRole, refreshRoles } = useAuth();
  const { membership } = useMyOrganization();
  const { theme, setTheme } = useTheme();
  const [switching, setSwitching] = useState(false);
  const isAdmin = hasAnyRole(["admin", "super_admin"]);
  const isTutor = Boolean(user && hasRole("tutor"));
  const useDarkTheme = theme !== "dark";
  const accountName =
    user?.user_metadata.display_name?.trim() || user?.email?.split("@")[0] || "Account";

  async function switchMode(role: "parent" | "tutor") {
    if (switching || role === activeRole) return;
    setSwitching(true);
    try {
      const { error } = await supabase.rpc("switch_role", { _role: role });
      if (error) throw error;
      await refreshRoles();
      toast.success(
        role === "tutor" ? t("nav.mode_switched_teaching") : t("nav.mode_switched_learning"),
      );
      void navigate({ to: role === "tutor" ? "/dashboard" : "/account" });
    } catch {
      toast.error(t("nav.mode_switch_error"));
    } finally {
      setSwitching(false);
    }
  }

  const icon = (Icon: typeof Settings) => <Icon className="h-5 w-5" aria-hidden />;

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--background)] pb-24">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-5 pt-6">
        <h1 className="text-3xl font-bold tracking-tight text-[color:var(--ink)]">
          {t("account_hub.title")}
        </h1>

        {user ? (
          <ProfileLink className="mt-5 flex items-center gap-4 rounded-[var(--radius-panel)] border border-border bg-card p-4">
            <InitialAvatar
              stableId={user.id}
              name={accountName}
              className="h-14 w-14 border-0 text-lg"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-lg font-bold text-[color:var(--ink)]">
                {accountName}
              </span>
              <span className="block truncate text-sm text-muted-foreground">
                {t("account_hub.view_profile")}
              </span>
            </span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden />
          </ProfileLink>
        ) : (
          <div className="mt-5 rounded-[var(--radius-panel)] border border-border bg-card p-5">
            <p className="text-base font-semibold text-[color:var(--ink)]">
              {t("account_hub.signed_out_title")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{t("account_hub.signed_out_body")}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button asChild variant="outline" className="h-11 rounded-full font-bold">
                <Link to="/auth">
                  <LogIn className="h-4 w-4" aria-hidden />
                  {t("nav.sign_in")}
                </Link>
              </Button>
              <Button asChild variant="solid" color="blue" className="h-11 rounded-full font-bold">
                <Link to="/auth">
                  <UserRoundPlus className="h-4 w-4" aria-hidden />
                  {t("nav.sign_up")}
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Become a Tutor card (Airbnb "Become a host"), or the mode switch
            once Teaching is active (#459 §B). */}
        {isTutor ? (
          <button
            type="button"
            disabled={switching}
            onClick={() => void switchMode(activeRole === "tutor" ? "parent" : "tutor")}
            className="mt-4 flex w-full items-center gap-4 rounded-[var(--radius-panel)] border border-border bg-[color:var(--surface-subtle)] p-4 text-left disabled:opacity-60"
          >
            <Repeat className="h-7 w-7 shrink-0 text-[color:var(--brand-link)]" aria-hidden />
            <span className="min-w-0 flex-1 text-[15px] font-semibold text-[color:var(--ink)]">
              {activeRole === "tutor" ? t("nav.switch_to_learning") : t("nav.switch_to_teaching")}
            </span>
          </button>
        ) : (
          <Link
            to="/join"
            className="mt-4 flex items-center gap-4 rounded-[var(--radius-panel)] border border-border bg-[color:var(--surface-subtle)] p-4"
          >
            <img src="/nav-become-tutor.png" alt="" aria-hidden className="h-10 w-10 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold text-[color:var(--ink)]">
                {t("nav.become_tutor")}
              </span>
              <span className="block text-sm text-muted-foreground">
                {t("account_hub.become_tutor_body")}
              </span>
            </span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden />
          </Link>
        )}

        {user ? (
          <Section title={t("account_hub.section_account")}>
            <Link to="/dashboard" className={rowClass}>
              <RowContent icon={icon(Settings)} label={t("nav.settings")} />
            </Link>
            <ProfileLink className={rowClass}>
              <RowContent icon={icon(UserRound)} label={t("account_hub.view_profile")} />
            </ProfileLink>
            <Link to="/dashboard" hash="privacy" className={rowClass}>
              <RowContent icon={icon(Lock)} label={t("account_hub.privacy")} />
            </Link>
            {/* #793 §2.6.4: Safety is an entry only, and only because the
                settings shell now has one (#650 trusted contact). The
                trusted-contact UI itself stays in #650 / #782 — this is a
                deep link into that tab, never a second Safety page. */}
            <Link to="/dashboard" hash="safety" className={rowClass}>
              <RowContent icon={icon(ShieldCheck)} label={t("settings.nav.safety")} />
            </Link>
            <Link to="/notifications" className={rowClass}>
              <RowContent icon={icon(BellRing)} label={t("account_hub.notifications")} />
            </Link>
            <Link to="/activity" className={rowClass}>
              <RowContent icon={icon(Activity)} label={t("account_hub.activity_row")} />
            </Link>
            <Link to="/account/studio" className={rowClass}>
              <RowContent icon={icon(Wallet)} label={t("studio.title")} />
            </Link>
            {(CENTRE_MARKET_ENABLED || membership) && (
              <Link to={membership ? "/business" : "/business/join"} className={rowClass}>
                <RowContent
                  icon={icon(Building2)}
                  label={membership ? t("nav.my_business") : t("nav.for_business")}
                />
              </Link>
            )}
            {isAdmin && (
              <Link to="/admin" className={rowClass}>
                <RowContent icon={icon(ShieldCheck)} label={t("nav.admin")} />
              </Link>
            )}
          </Section>
        ) : null}

        <Section title={t("account_hub.section_explore")}>
          <Link to="/calendar" className={rowClass}>
            <RowContent icon={icon(CalendarDays)} label={t("nav.tab_calendar")} />
          </Link>
          <Link to="/guide" className={rowClass}>
            <RowContent icon={icon(BookOpen)} label={t("nav.how")} />
          </Link>
          <Link to="/guide/refer" className={rowClass}>
            <RowContent icon={icon(Gift)} label={t("account_hub.refer")} />
          </Link>
          <Link to="/help" className={rowClass}>
            <RowContent icon={icon(CircleHelp)} label={t("nav.help")} />
          </Link>
          <Link to="/tos" className={rowClass}>
            <RowContent icon={icon(Scale)} label={t("account_hub.legal")} />
          </Link>
        </Section>

        <Section title={t("account_hub.section_preferences")}>
          <button
            type="button"
            onClick={() => setTheme(useDarkTheme ? "dark" : "light")}
            className={rowClass}
          >
            <RowContent
              icon={icon(useDarkTheme ? Moon : Sun)}
              label={useDarkTheme ? t("nav.dark_mode") : t("nav.light_mode")}
            />
          </button>
          <div className="flex items-center gap-3.5 px-1 py-3">
            <span className="flex h-6 w-6 items-center justify-center text-[color:var(--ink)]">
              {icon(Globe)}
            </span>
            <span className="flex-1 text-[15px] font-medium text-[color:var(--ink)]">
              {t("nav.account_language")}
            </span>
            <span className="flex shrink-0 items-center gap-2 whitespace-nowrap">
              <LanguageToggle />
              <CurrencyToggle />
            </span>
          </div>
        </Section>

        {user ? (
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-6 flex items-center gap-2 text-[15px] font-semibold text-[color:var(--ink)] underline underline-offset-4"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {t("nav.sign_out")}
          </button>
        ) : null}
      </main>
    </div>
  );
}
