import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bookmark,
  Building2,
  CircleUserRound,
  Compass,
  Globe,
  LogIn,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  UserRound,
  UserRoundPlus,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "motion/react";

import { LanguageToggle } from "@/components/brand/LanguageToggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { InitialAvatar } from "@/components/ui/initial-avatar";
import { useAuth } from "@/features/auth/useAuth";
import { useMyOrganization } from "@/features/business/useMyOrganization";
import { useTheme } from "@/features/theme/ThemeProvider";
import { CENTRE_MARKET_ENABLED } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

const tabButtonClass =
  "relative flex flex-1 flex-col items-center gap-1 px-2 py-2.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40";

/**
 * Fixed mobile bottom navigation: Explore, Saved and Account (the account tab
 * opens a bottom sheet with settings, business, admin and appearance rows).
 * Hidden on lg+ where the desktop header takes over.
 */
export function MobileBottomNav() {
  const { t } = useTranslation();
  const { user, hasAnyRole } = useAuth();
  const { membership } = useMyOrganization();
  const hasOrg = !!membership;
  const isAdmin = hasAnyRole(["admin", "super_admin"]);
  const { theme, setTheme } = useTheme();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  const [accountOpen, setAccountOpen] = useState(false);
  // OS Reduce Motion must silence the sliding indicators too (#398 review):
  // layoutId springs are transform/layout animations, which motion plays
  // regardless of the media query unless gated here.
  const prefersReducedMotion = useReducedMotion();

  const accountName =
    user?.user_metadata.display_name?.trim() || user?.email?.split("@")[0] || "Account";
  const useDarkTheme = theme !== "dark";

  const itemRowClass =
    "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium text-[color:var(--ink)] transition-colors hover:bg-[color:var(--foreground)]/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

  return (
    <>
      <nav
        aria-label={t("nav.account_menu_label")}
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-[color:var(--surface)]/98 backdrop-blur-sm lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-stretch pb-[env(safe-area-inset-bottom)]">
          <Link
            to="/tutors"
            aria-current={isActive("/tutors") ? "page" : undefined}
            className={cn(
              tabButtonClass,
              isActive("/tutors")
                ? "text-[color:var(--ink)]"
                : "text-[color:var(--ink)]/55 hover:text-[color:var(--ink)]",
            )}
          >
            {/* Sliding active indicator: the top bar springs between tabs
                instead of vanishing/reappearing on the active one. */}
            <span aria-hidden="true" className="absolute inset-x-6 top-0 h-0.5">
              {isActive("/tutors") ? (
                <motion.span
                  layoutId="mobile-bottom-nav-indicator"
                  className="block h-0.5 rounded-full bg-[color:var(--foreground)]"
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { type: "spring", bounce: 0.15, duration: 0.4 }
                  }
                />
              ) : null}
            </span>
            <Compass className="h-5 w-5" aria-hidden="true" />
            {t("nav_mobile.explore")}
          </Link>
          <Link
            to="/saved-posts"
            aria-current={isActive("/saved-posts") ? "page" : undefined}
            className={cn(
              tabButtonClass,
              isActive("/saved-posts")
                ? "text-[color:var(--ink)]"
                : "text-[color:var(--ink)]/55 hover:text-[color:var(--ink)]",
            )}
          >
            {/* Sliding active indicator (shared layoutId with Explore). */}
            <span aria-hidden="true" className="absolute inset-x-6 top-0 h-0.5">
              {isActive("/saved-posts") ? (
                <motion.span
                  layoutId="mobile-bottom-nav-indicator"
                  className="block h-0.5 rounded-full bg-[color:var(--foreground)]"
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { type: "spring", bounce: 0.15, duration: 0.4 }
                  }
                />
              ) : null}
            </span>
            <Bookmark className="h-5 w-5" aria-hidden="true" />
            {t("nav_mobile.saved_posts")}
          </Link>
          <button
            type="button"
            aria-expanded={accountOpen}
            className={cn(tabButtonClass, "text-[color:var(--ink)]")}
            onClick={() => setAccountOpen(true)}
          >
            <CircleUserRound className="h-5 w-5" aria-hidden="true" />
            {t("nav_mobile.account")}
          </button>
        </div>
      </nav>

      <Sheet open={accountOpen} onOpenChange={setAccountOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-border bg-[color:var(--surface)] px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
        >
          <div
            aria-hidden="true"
            className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[color:var(--foreground)]/20"
          />
          <SheetTitle className="sr-only">{t("nav.account_title")}</SheetTitle>
          <div className="space-y-1.5">
            {user ? (
              <>
                <div className="flex items-center gap-3 px-3 pt-1 pb-4">
                  {/* Issue #437: client accounts use the branded initial
                      avatar, no photo upload in V1. */}
                  <InitialAvatar
                    stableId={user.id}
                    name={accountName}
                    className="h-11 w-11 border-0 text-base"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium text-[color:var(--ink)]">
                      {accountName}
                    </span>
                    <span className="block truncate text-xs font-normal text-[color:var(--ink)]/60">
                      {user.email}
                    </span>
                  </span>
                </div>
                <Link
                  to="/dashboard"
                  onClick={() => setAccountOpen(false)}
                  className={itemRowClass}
                >
                  <Settings className="h-5 w-5 text-[color:var(--ink)]" aria-hidden="true" />
                  {t("nav.settings")}
                </Link>
                <Link
                  to="/dashboard"
                  hash="profile"
                  onClick={() => setAccountOpen(false)}
                  className={itemRowClass}
                >
                  <UserRound className="h-5 w-5 text-[color:var(--ink)]" aria-hidden="true" />
                  {t("nav.profile")}
                </Link>
                {(CENTRE_MARKET_ENABLED || hasOrg) && (
                  <Link
                    to={hasOrg ? "/business" : "/business/join"}
                    onClick={() => setAccountOpen(false)}
                    className={itemRowClass}
                  >
                    <Building2 className="h-5 w-5 text-[color:var(--ink)]" aria-hidden="true" />
                    {hasOrg ? t("nav.my_business") : t("nav.for_business")}
                  </Link>
                )}
                {isAdmin && (
                  <Link to="/admin" onClick={() => setAccountOpen(false)} className={itemRowClass}>
                    <ShieldCheck className="h-5 w-5 text-[color:var(--ink)]" aria-hidden="true" />
                    {t("nav.admin")}
                  </Link>
                )}
              </>
            ) : (
              <>
                <div className="flex flex-col gap-2 px-3 pt-1 pb-4">
                  <Button
                    asChild
                    variant="outline"
                    className="h-11 w-full rounded-full text-sm font-medium"
                  >
                    <Link to="/auth" onClick={() => setAccountOpen(false)}>
                      <LogIn className="h-4 w-4" aria-hidden="true" />
                      {t("nav.sign_in")}
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="solid"
                    color="blue"
                    className="h-11 w-full rounded-full text-sm font-medium"
                  >
                    <Link to="/auth" onClick={() => setAccountOpen(false)}>
                      <UserRoundPlus className="h-4 w-4" aria-hidden="true" />
                      {t("nav.sign_up")}
                    </Link>
                  </Button>
                </div>
              </>
            )}
            <button
              type="button"
              onClick={() => setTheme(useDarkTheme ? "dark" : "light")}
              className={cn(itemRowClass, "border-t border-border pt-3")}
            >
              {useDarkTheme ? (
                <Moon className="h-5 w-5 text-[color:var(--ink)]" aria-hidden="true" />
              ) : (
                <Sun className="h-5 w-5 text-[color:var(--ink)]" aria-hidden="true" />
              )}
              {useDarkTheme ? t("nav.dark_mode") : t("nav.light_mode")}
            </button>
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-border px-3 pt-3">
              <span className="flex items-center gap-3 text-[15px] font-medium text-[color:var(--ink)]">
                <Globe className="h-5 w-5 text-[color:var(--ink)]" aria-hidden="true" />
                {t("nav.account_language")}
              </span>
              <LanguageToggle />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
