import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bookmark,
  Building2,
  CircleHelp,
  Globe,
  Menu,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react";
import { motion, useMotionValueEvent, useTransform } from "motion/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { LanguageToggle } from "@/components/brand/LanguageToggle";
import { Logo } from "@/components/brand/Logo";
import { COLLAPSE_MIDPOINT, useSearchGroup } from "@/components/search/sticky-search-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/useAuth";
import { useMyOrganization } from "@/features/business/useMyOrganization";
import { useTheme } from "@/features/theme/ThemeProvider";
import { CENTRE_MARKET_ENABLED } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

import { AnnouncementBanner } from "./AnnouncementBanner";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { StaggeredMobileMenu } from "./StaggeredMobileMenu";

type NavDestination =
  | "/how-it-works"
  | "/tutors"
  | "/courses"
  | "/saved-posts"
  | "/join"
  | "/pricing"
  | "/tutor-requests"
  | "/help";

/** Shared item styling for the Airbnb-style header popovers. */
const menuLinkClassName =
  "cursor-pointer gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium text-[color:var(--ink)] focus:bg-[color:var(--foreground)]/[0.06] focus:text-[color:var(--ink)]";

/** Promo-card row styling (bold title + muted subtitle). */
const menuCardClassName =
  "cursor-pointer gap-3 rounded-lg px-3 py-2.5 text-[15px] text-[color:var(--ink)] focus:bg-[color:var(--foreground)]/[0.06] focus:text-[color:var(--ink)]";

/** Wraps a lucide icon so the item's `[&>svg]` sizing rule leaves it at 20px. */
function MenuIcon({ children }: { children: React.ReactNode }) {
  return (
    <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center">
      {children}
    </span>
  );
}

/** Full-bleed hairline between the menu's sections. */
function MenuDivider() {
  return <DropdownMenuSeparator className="mx-0 my-0 bg-[color:var(--ink)]/10" />;
}

/** Round icon trigger for the header popovers (avatar / burger). */
const headerCircleClassName =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[color:var(--foreground)]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

/** Centered category tab for the lg+ nav row — Airbnb-style icon + label with an active underline. */
function DesktopTab({
  to,
  active,
  icon,
  children,
}: {
  to: NavDestination;
  active: boolean;
  /** Icon asset (public/ path) rendered before the label. */
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-full items-center gap-2 whitespace-nowrap px-3 text-sm font-semibold transition-colors duration-200 focus-visible:text-[color:var(--ink)] xl:px-4",
        active
          ? "text-[color:var(--ink)]"
          : "text-[color:var(--ink)]/60 hover:text-[color:var(--ink)]",
      )}
    >
      <img
        src={icon}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="h-6 w-6 shrink-0 dark:invert-[0.85] dark:hue-rotate-180"
      />
      {children}
      <span
        className={cn(
          "absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-[color:var(--foreground)] transition-opacity duration-200 xl:inset-x-4",
          active ? "opacity-100" : "opacity-0",
        )}
      />
    </Link>
  );
}

export function SiteHeader({
  className,
  tone = "light",
  merged = false,
  centerSlot,
}: {
  className?: string;
  tone?: "light" | "dark";
  /**
   * Grouped search-header mode (directory pages): no divider under the nav,
   * shared #FEFEFE band with the search area below, and the category tabs fade
   * out while the compact search pill is showing.
   */
  merged?: boolean;
  /** Compact search pill rendered centered in the nav row (merged mode). */
  centerSlot?: React.ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const { user, signOut, hasAnyRole } = useAuth();
  const { membership } = useMyOrganization();
  const hasOrg = !!membership;
  const { theme, setTheme } = useTheme();
  const isAdmin = hasAnyRole(["admin", "super_admin"]);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  const { collapseProgress } = useSearchGroup();
  const hasCenterPill = merged && !!centerSlot;
  const [pastMid, setPastMid] = useState(false);
  useMotionValueEvent(collapseProgress, "change", (p) => setPastMid(p > COLLAPSE_MIDPOINT));
  // Tabs share the center with the compact pill: as the collapse scrubs in,
  // the tabs slide up out of the header while the pill rises into their place.
  // Visible at the top AND in the expanded (tinted) state, where progress is
  // held open.
  const linksVisible = !hasCenterPill || !pastMid;
  const pillVisible = hasCenterPill && pastMid;
  const navY = useTransform(collapseProgress, [0, 0.55], [0, -72]);
  const navOpacity = useTransform(collapseProgress, [0.3, 0.55], [1, 0]);
  const pillY = useTransform(collapseProgress, [0.45, 0.85], [28, 0]);
  const pillOpacity = useTransform(collapseProgress, [0.45, 0.7], [0, 1]);
  const accountName =
    user?.user_metadata.display_name?.trim() || user?.email?.split("@")[0] || "Account";
  const accountInitial = accountName.charAt(0).toUpperCase();
  const useDarkTheme = theme !== "dark";
  const currentLang = i18n.language?.startsWith("zh") ? "zh-HK" : "en";
  const nextLang = currentLang === "en" ? "zh-HK" : "en";
  const brandLabelClassName = "text-lg font-bold tracking-tight text-brand-gradient sm:text-xl";

  // Mobile keeps a slim top bar (logo + staggered menu); the fixed bottom
  // tab bar handles account navigation and must render outside the header.
  const mobileItems = [
    { label: t("nav.how"), ariaLabel: t("nav.how"), to: "/how-it-works" },
    { label: t("nav.find"), ariaLabel: t("nav.find"), to: "/tutors" },
    ...(CENTRE_MARKET_ENABLED
      ? [{ label: t("nav.courses"), ariaLabel: t("nav.courses"), to: "/courses" }]
      : []),
    { label: t("nav.saved_posts"), ariaLabel: t("nav.saved_posts"), to: "/saved-posts" },
    { label: t("nav.become_tutor"), ariaLabel: t("nav.become_tutor"), to: "/join" },
    ...(CENTRE_MARKET_ENABLED
      ? [{ label: t("nav.for_business"), ariaLabel: t("nav.for_business"), to: "/pricing" }]
      : []),
    ...(hasOrg
      ? [{ label: t("nav.my_business"), ariaLabel: t("nav.my_business"), to: "/business" }]
      : []),
    { label: t("nav.request_tutor"), ariaLabel: t("nav.request_tutor"), to: "/tutor-requests" },
    { label: t("nav.help"), ariaLabel: t("nav.help"), to: "/help" },
    ...(user ? [{ label: t("nav.settings"), ariaLabel: t("nav.settings"), to: "/dashboard" }] : []),
    ...(isAdmin ? [{ label: t("nav.admin"), ariaLabel: t("nav.admin"), to: "/admin" }] : []),
  ];
  return (
    <>
      <header
        data-site-header=""
        className={cn(
          "sticky top-0 z-50 hidden w-full lg:block",
          merged
            ? "bg-[color:var(--surface-header)]"
            : "border-b border-[color:var(--ink)]/10 bg-[color:var(--surface)]/95 backdrop-blur-sm",
          tone === "dark" && "site-header--dark",
          className,
        )}
      >
        <div className="relative mx-auto flex h-[64px] max-w-[1440px] items-center gap-2 px-4 sm:px-8 lg:gap-0 xl:px-10">
          {merged && centerSlot ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <motion.div
                style={hasCenterPill ? { y: pillY, opacity: pillOpacity } : undefined}
                className={pillVisible ? "pointer-events-auto" : "pointer-events-none"}
              >
                {centerSlot}
              </motion.div>
            </div>
          ) : null}
          <Link to="/" className="flex shrink-0 items-center" aria-label="MatchMax home">
            <div className="flex items-center gap-2">
              <Logo className="shrink-0" />
              <span className={brandLabelClassName}>MatchMax</span>
            </div>
          </Link>

          <div className="pointer-events-none absolute inset-0 flex justify-center overflow-hidden">
            <motion.nav
              aria-label={t("nav.site_menu")}
              style={hasCenterPill ? { y: navY, opacity: navOpacity } : undefined}
              className={cn(
                "flex h-full items-stretch",
                linksVisible ? "pointer-events-auto" : "pointer-events-none",
              )}
            >
              <DesktopTab to="/tutors" active={isActive("/tutors")} icon="/nav-find.png">
                {t("nav.tab_tutors")}
              </DesktopTab>
              <DesktopTab
                to="/how-it-works"
                active={isActive("/how-it-works")}
                icon="/nav-how-it-works.png"
              >
                {t("nav.how")}
              </DesktopTab>
              <DesktopTab to="/saved-posts" active={isActive("/saved-posts")} icon="/nav-saved.png">
                {t("nav.tab_saved")}
              </DesktopTab>
              <DesktopTab
                to="/tutor-requests"
                active={isActive("/tutor-requests")}
                icon="/nav-case-board.png"
              >
                {t("nav.tab_cases")}
              </DesktopTab>
            </motion.nav>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <Link
              to="/join"
              aria-current={isActive("/join") ? "page" : undefined}
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-[color:var(--foreground)]/[0.05] sm:px-4",
                isActive("/join")
                  ? "text-[color:var(--brand-link)]"
                  : "text-[color:var(--ink)] hover:text-[color:var(--ink)]",
              )}
            >
              {t("nav.become_tutor")}
            </Link>

            {user ? (
              <Link
                to="/dashboard"
                hash="profile"
                aria-label={t("nav.profile")}
                className={headerCircleClassName}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--foreground)] text-sm font-bold text-[color:var(--background)]">
                  {accountInitial}
                </span>
              </Link>
            ) : (
              <Link to="/auth" aria-label={t("nav.sign_in")} className={headerCircleClassName}>
                <UserRound className="h-5 w-5 text-[color:var(--ink)]" aria-hidden="true" />
              </Link>
            )}

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t("nav.site_menu")}
                  className={headerCircleClassName}
                >
                  <Menu
                    className="h-5 w-5 text-[color:var(--ink)]"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-80 overflow-hidden rounded-2xl border-[color:var(--ink)]/10 bg-[color:var(--surface)] p-0"
              >
                {user ? (
                  <div className="px-1.5 py-1.5">
                    <DropdownMenuItem asChild className={menuLinkClassName}>
                      <Link to="/saved-posts">
                        <MenuIcon>
                          <Bookmark className="size-5" />
                        </MenuIcon>
                        {t("nav.saved_posts")}
                      </Link>
                    </DropdownMenuItem>
                    {hasOrg && (
                      <DropdownMenuItem asChild className={menuLinkClassName}>
                        <Link to="/business" search={{ tab: undefined }}>
                          <MenuIcon>
                            <Building2 className="size-5" />
                          </MenuIcon>
                          {t("nav.my_business")}
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild className={menuLinkClassName}>
                      <Link to="/dashboard" hash="profile">
                        <MenuIcon>
                          <UserRound className="size-5" />
                        </MenuIcon>
                        {t("nav.profile")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className={menuLinkClassName}>
                      <Link to="/dashboard">
                        <MenuIcon>
                          <Settings className="size-5" />
                        </MenuIcon>
                        {t("nav.settings")}
                      </Link>
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem asChild className={menuLinkClassName}>
                        <Link to="/admin">
                          <MenuIcon>
                            <ShieldCheck className="size-5" />
                          </MenuIcon>
                          {t("nav.admin")}
                        </Link>
                      </DropdownMenuItem>
                    )}
                  </div>
                ) : (
                  <div className="px-1.5 py-1.5">
                    <DropdownMenuItem asChild className={menuLinkClassName}>
                      <Link to="/auth" search={{ mode: "sign_up" }}>
                        {t("nav.sign_up")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className={menuLinkClassName}>
                      <Link to="/auth">{t("nav.sign_in")}</Link>
                    </DropdownMenuItem>
                  </div>
                )}
                <MenuDivider />
                <div className="px-1.5 py-1.5">
                  <DropdownMenuItem
                    onSelect={() => void i18n.changeLanguage(nextLang)}
                    className={menuLinkClassName}
                  >
                    <MenuIcon>
                      <Globe className="size-5" />
                    </MenuIcon>
                    {t("nav.account_language")}
                    <span className="ml-auto text-xs font-bold text-[color:var(--ink)]/55">
                      {currentLang === "en" ? "EN" : "繁"}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setTheme(useDarkTheme ? "dark" : "light")}
                    className={menuLinkClassName}
                  >
                    <MenuIcon>
                      {useDarkTheme ? <Moon className="size-5" /> : <Sun className="size-5" />}
                    </MenuIcon>
                    {useDarkTheme ? t("nav.dark_mode") : t("nav.light_mode")}
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className={menuLinkClassName}>
                    <Link to="/help">
                      <MenuIcon>
                        <CircleHelp className="size-5" />
                      </MenuIcon>
                      {t("nav.help")}
                    </Link>
                  </DropdownMenuItem>
                </div>
                <MenuDivider />
                <div className="px-1.5 py-1.5">
                  <DropdownMenuItem asChild className={menuCardClassName}>
                    <Link to="/join">
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold leading-5">
                          {t("nav.become_tutor")}
                        </span>
                        <span className="mt-1 block text-[13px] font-normal leading-4 text-[color:var(--ink)]/60">
                          {t("nav.become_tutor_subtitle")}
                        </span>
                      </span>
                      <img
                        src="/nav-become-tutor.png"
                        alt=""
                        aria-hidden="true"
                        draggable={false}
                        className="h-12 w-12 shrink-0 object-contain dark:invert-[0.85] dark:hue-rotate-180"
                      />
                    </Link>
                  </DropdownMenuItem>
                </div>
                <MenuDivider />
                <div className="px-1.5 py-1.5">
                  <DropdownMenuItem asChild className={menuLinkClassName}>
                    <Link to="/case-request">{t("nav.post_case")}</Link>
                  </DropdownMenuItem>
                  {CENTRE_MARKET_ENABLED && (
                    <DropdownMenuItem asChild className={menuLinkClassName}>
                      <Link to="/pricing">{t("nav.for_business")}</Link>
                    </DropdownMenuItem>
                  )}
                  {CENTRE_MARKET_ENABLED && (
                    <DropdownMenuItem asChild className={menuLinkClassName}>
                      <Link to="/courses">{t("nav.courses")}</Link>
                    </DropdownMenuItem>
                  )}
                </div>
                {user && (
                  <>
                    <MenuDivider />
                    <div className="px-1.5 py-1.5">
                      <DropdownMenuItem
                        onSelect={() => void signOut()}
                        className={menuLinkClassName}
                      >
                        {t("nav.sign_out")}
                      </DropdownMenuItem>
                    </div>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <AnnouncementBanner />
      </header>
      <div className="sticky top-0 z-50 border-b border-[color:var(--ink)]/10 bg-[color:var(--surface)]/95 backdrop-blur-sm lg:hidden">
        <div className="flex h-14 items-center justify-between gap-2 px-4">
          <Link to="/" className="flex shrink-0 items-center" aria-label="MatchMax home">
            <div className="flex items-center gap-2">
              <Logo className="shrink-0" />
              <span className={brandLabelClassName}>MatchMax</span>
            </div>
          </Link>
          <StaggeredMobileMenu
            items={mobileItems}
            renderFooter={(closeMenu) => (
              <div className="flex flex-col gap-3">
                {!user ? (
                  <>
                    <Link to="/auth" onClick={closeMenu}>
                      <Button
                        variant="outline"
                        className="h-10 w-full rounded-full border-[color:var(--ink)]/15 text-sm font-semibold text-[color:var(--ink)] hover:bg-[color:var(--foreground)]/[0.06] hover:text-[color:var(--ink)]"
                      >
                        {t("nav.sign_in")}
                      </Button>
                    </Link>
                    <Link to="/auth" search={{ mode: "sign_up" }} onClick={closeMenu}>
                      <Button
                        variant="solid"
                        color="blue"
                        className="h-10 w-full rounded-full text-sm font-semibold"
                      >
                        {t("nav.sign_up")}
                      </Button>
                    </Link>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      void signOut();
                      closeMenu();
                    }}
                    className="h-10 w-full rounded-full border border-[color:var(--ink)]/15 text-sm font-semibold text-[color:var(--ink)] transition-colors hover:bg-[color:var(--destructive)]/10 hover:text-[color:var(--destructive)]"
                  >
                    {t("nav.sign_out")}
                  </button>
                )}
                <div className="flex items-center justify-start pt-2">
                  <LanguageToggle />
                </div>
              </div>
            )}
          />
        </div>
      </div>
      <MobileBottomNav />
    </>
  );
}
