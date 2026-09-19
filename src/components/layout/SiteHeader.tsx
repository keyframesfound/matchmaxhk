import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bookmark,
  BookOpen,
  Building2,
  ChevronsUpDown,
  LogOut,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { LanguageToggle } from "@/components/brand/LanguageToggle";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth/useAuth";
import { useMyOrganization } from "@/features/business/useMyOrganization";
import { useTheme } from "@/features/theme/ThemeProvider";
import { CENTRE_MARKET_ENABLED } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

import { AnnouncementBanner } from "./AnnouncementBanner";
import { MobileBottomNav } from "./mobile-bottom-nav";

type NavDestination =
  | "/how-it-works"
  | "/tutors"
  | "/courses"
  | "/saved-posts"
  | "/join"
  | "/pricing"
  | "/tutor-requests";

function DesktopNavLink({
  to,
  active,
  children,
}: {
  to: NavDestination;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative text-[15px] font-semibold transition-colors duration-200 focus-visible:text-[color:var(--brand-link)]",
        active
          ? "text-[color:var(--brand-link)]"
          : "text-[color:var(--ink)]/85 hover:text-[color:var(--brand-link)]",
      )}
    >
      {children}
      <span
        className={cn(
          "absolute -bottom-2 left-0 h-[2px] rounded-full bg-[color:var(--foreground)] transition-all duration-200",
          active ? "w-full" : "w-0 group-hover:w-full",
        )}
      />
    </Link>
  );
}

/** Compact top-bar link for mobile (Case / How it works / Become tutor). */
function MobileTopNavLink({
  to,
  active,
  children,
}: {
  to: NavDestination;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "truncate text-[13px] font-semibold transition-colors duration-200 sm:text-[15px]",
        active
          ? "text-[color:var(--ink)]"
          : "text-[color:var(--ink)]/70 hover:text-[color:var(--ink)]",
      )}
    >
      {children}
    </Link>
  );
}

export function SiteHeader({
  className,
  tone = "light",
}: {
  className?: string;
  tone?: "light" | "dark";
}) {
  const { t } = useTranslation();
  const { user, signOut, hasAnyRole } = useAuth();
  const { membership } = useMyOrganization();
  const hasOrg = !!membership;
  const { theme, setTheme } = useTheme();
  const isAdmin = hasAnyRole(["admin", "super_admin"]);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  const accountName =
    user?.user_metadata.display_name?.trim() || user?.email?.split("@")[0] || "Account";
  const accountInitial = accountName.charAt(0).toUpperCase();
  const useDarkTheme = theme !== "dark";
  const brandLabelClassName =
    "hidden text-lg font-bold tracking-tight text-brand-gradient sm:inline sm:text-xl";

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b border-[color:var(--ink)]/10 bg-[color:var(--surface)]/95 backdrop-blur-sm",
        tone === "dark" && "site-header--dark",
        className,
      )}
    >
      <div className="mx-auto flex h-[64px] max-w-[1440px] items-center gap-2 px-4 sm:px-8 lg:gap-0 lg:px-10">
        <Link to="/" className="flex shrink-0 items-center" aria-label="MatchMax home">
          <div className="flex items-center gap-2">
            <Logo className="shrink-0" />
            <span className={brandLabelClassName}>MatchMax</span>
          </div>
        </Link>

        {/* Mobile top nav: Case / How it works / Become tutor */}
        <nav className="ml-auto flex min-w-0 items-center gap-3 sm:gap-5 lg:hidden">
          <MobileTopNavLink to="/tutor-requests" active={isActive("/tutor-requests")}>
            {t("nav_mobile.case")}
          </MobileTopNavLink>
          <MobileTopNavLink to="/how-it-works" active={isActive("/how-it-works")}>
            {t("nav.how")}
          </MobileTopNavLink>
          <MobileTopNavLink to="/join" active={isActive("/join")}>
            {t("nav.become_tutor")}
          </MobileTopNavLink>
        </nav>

        <nav className="ml-12 hidden items-center gap-9 lg:flex">
          <DesktopNavLink to="/how-it-works" active={isActive("/how-it-works")}>
            {t("nav.how")}
          </DesktopNavLink>
          <DesktopNavLink to="/tutors" active={isActive("/tutors")}>
            {t("nav.find")}
          </DesktopNavLink>
          {CENTRE_MARKET_ENABLED && (
            <DesktopNavLink to="/courses" active={isActive("/courses")}>
              {t("nav.courses")}
            </DesktopNavLink>
          )}
          <DesktopNavLink to="/saved-posts" active={isActive("/saved-posts")}>
            {t("nav.saved_posts")}
          </DesktopNavLink>
          <DesktopNavLink to="/join" active={isActive("/join")}>
            {t("nav.become_tutor")}
          </DesktopNavLink>
          {CENTRE_MARKET_ENABLED && (
            <DesktopNavLink to="/pricing" active={isActive("/pricing")}>
              {t("nav.for_business")}
            </DesktopNavLink>
          )}
          <DesktopNavLink to="/tutor-requests" active={isActive("/tutor-requests")}>
            {t("nav.request_tutor")}
          </DesktopNavLink>
        </nav>

        <div className="ml-auto hidden items-center gap-2 sm:gap-4 lg:flex">
          <div className="flex items-center">
            <LanguageToggle />
          </div>
          {user ? (
            <div>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-auto w-60 justify-start gap-3 rounded-lg border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] p-2 text-left text-[color:var(--ink)] transition-colors hover:bg-[color:var(--surface)] hover:text-[color:var(--ink)]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--foreground)] text-[color:var(--background)] text-sm font-bold">
                      {accountInitial}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold leading-5">
                        {accountName}
                      </span>
                      <span className="block truncate text-xs font-normal leading-4 text-[color:var(--ink)]/55">
                        {user.email}
                      </span>
                    </span>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[color:var(--ink)]/45">
                      <ChevronsUpDown className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-60 overflow-hidden rounded-lg border-[color:var(--ink)]/10 bg-[color:var(--surface)] p-0"
                >
                  <DropdownMenuLabel className="border-b border-[color:var(--ink)]/10 px-4 py-3">
                    <div className="text-sm font-semibold text-[color:var(--ink)]">
                      {t("nav.account_title")}
                    </div>
                    <div className="mt-0.5 text-xs font-normal text-[color:var(--ink)]/60">
                      {t("nav.account_subtitle")}
                    </div>
                  </DropdownMenuLabel>
                  <div className="p-1.5">
                    <DropdownMenuItem
                      asChild
                      className="cursor-pointer rounded-md px-3 py-2.5 font-medium text-[color:var(--ink)] focus:bg-[color:var(--foreground)]/[0.06] focus:text-[color:var(--ink)]"
                    >
                      <Link to="/dashboard" hash="profile">
                        <UserRound aria-hidden="true" />
                        {t("nav.profile")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      asChild
                      className="cursor-pointer rounded-md px-3 py-2.5 font-medium text-[color:var(--ink)] focus:bg-[color:var(--foreground)]/[0.06] focus:text-[color:var(--ink)]"
                    >
                      <Link to="/dashboard">
                        <Settings aria-hidden="true" />
                        {t("nav.settings")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      asChild
                      className="cursor-pointer rounded-md px-3 py-2.5 font-medium text-[color:var(--ink)] focus:bg-[color:var(--foreground)]/[0.06] focus:text-[color:var(--ink)]"
                    >
                      <Link to="/saved-posts">
                        <Bookmark aria-hidden="true" />
                        {t("nav.saved_posts")}
                      </Link>
                    </DropdownMenuItem>
                    {(CENTRE_MARKET_ENABLED || hasOrg) && (
                      <DropdownMenuItem
                        asChild
                        className="cursor-pointer rounded-md px-3 py-2.5 font-medium text-[color:var(--ink)] focus:bg-[color:var(--foreground)]/[0.06] focus:text-[color:var(--ink)]"
                      >
                        <Link to={hasOrg ? "/business" : "/business/join"}>
                          <Building2 aria-hidden="true" />
                          {hasOrg ? t("nav.my_business") : t("nav.for_business")}
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onSelect={() => setTheme(useDarkTheme ? "dark" : "light")}
                      className="cursor-pointer rounded-md px-3 py-2.5 font-medium text-[color:var(--ink)] focus:bg-[color:var(--foreground)]/[0.06] focus:text-[color:var(--ink)]"
                    >
                      {useDarkTheme ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
                      {useDarkTheme ? t("nav.dark_mode") : t("nav.light_mode")}
                    </DropdownMenuItem>
                    {isAdmin && (
                      <>
                        <DropdownMenuSeparator className="my-1.5" />
                        <DropdownMenuItem
                          asChild
                          className="cursor-pointer rounded-md px-3 py-2.5 font-medium text-[color:var(--ink)] focus:bg-[color:var(--foreground)]/[0.06] focus:text-[color:var(--ink)]"
                        >
                          <Link to="/admin">
                            <ShieldCheck aria-hidden="true" />
                            {t("nav.admin")}
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator className="my-1.5" />
                    <DropdownMenuItem
                      onSelect={() => void signOut()}
                      className="cursor-pointer rounded-md px-3 py-2.5 font-medium text-[color:var(--ink)] focus:bg-[color:var(--destructive)]/10 focus:text-[color:var(--destructive)]"
                    >
                      <LogOut aria-hidden="true" />
                      {t("nav.sign_out")}
                    </DropdownMenuItem>
                  </div>
                  <div className="flex items-center justify-between border-t border-[color:var(--ink)]/10 px-4 py-2.5 text-xs text-[color:var(--ink)]/50">
                    <span>MatchMax</span>
                    <span>{t("nav.account_menu_label")}</span>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <>
              <Link
                to="/auth"
                className="text-[15px] font-semibold text-[color:var(--ink)] transition-colors hover:text-[color:var(--brand-link)]"
              >
                {t("nav.sign_in")}
              </Link>
              <Link to="/auth" search={{ mode: "sign_up" }}>
                <Button
                  variant="solid"
                  color="blue"
                  className="h-11 rounded-full px-6 text-[15px] font-semibold transition-all duration-200"
                >
                  {t("nav.sign_up")}
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
      <AnnouncementBanner />
      <MobileBottomNav />
    </header>
  );
}
