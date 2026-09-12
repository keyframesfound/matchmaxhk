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
import { StaggeredMobileMenu } from "./StaggeredMobileMenu";

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
  const brandLabelClassName = "text-lg font-bold tracking-tight text-brand-gradient sm:text-xl";
  const mobileItems = [
    { label: t("nav.how"), ariaLabel: t("nav.how"), to: "/how-it-works" },
    {
      label: t("nav.find"),
      ariaLabel: t("nav.find"),
      to: "/tutors",
    },
    ...(CENTRE_MARKET_ENABLED
      ? [
          {
            label: t("nav.courses"),
            ariaLabel: t("nav.courses"),
            to: "/courses",
          },
        ]
      : []),
    { label: t("nav.saved_posts"), ariaLabel: t("nav.saved_posts"), to: "/saved-posts" },
    { label: t("nav.become_tutor"), ariaLabel: t("nav.become_tutor"), to: "/join" },
    ...(CENTRE_MARKET_ENABLED
      ? [
          {
            label: t("nav.for_business"),
            ariaLabel: t("nav.for_business"),
            to: "/pricing",
          },
        ]
      : []),
    ...(hasOrg
      ? [{ label: t("nav.my_business"), ariaLabel: t("nav.my_business"), to: "/business" }]
      : []),
    { label: t("nav.request_tutor"), ariaLabel: t("nav.request_tutor"), to: "/tutor-requests" },
    ...(user ? [{ label: t("nav.settings"), ariaLabel: t("nav.settings"), to: "/dashboard" }] : []),
    ...(isAdmin ? [{ label: t("nav.admin"), ariaLabel: t("nav.admin"), to: "/admin" }] : []),
  ];

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b border-[color:var(--ink)]/10 bg-[color:var(--surface)]/95 backdrop-blur-sm",
        tone === "dark" && "site-header--dark",
        className,
      )}
    >
      <div className="mx-auto flex h-[64px] max-w-[1440px] items-center px-4 sm:px-8 lg:px-10">
        <Link to="/" className="flex shrink-0 items-center" aria-label="MatchMax home">
          <div className="flex items-center gap-2">
            <Logo className="shrink-0" />
            <span className={brandLabelClassName}>MatchMax</span>
          </div>
        </Link>

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

        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <div className="flex items-center">
            <LanguageToggle />
          </div>
          {user ? (
            <div className="hidden lg:block">
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-auto w-60 justify-start gap-3 rounded-lg border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] p-2 text-left text-[color:var(--ink)] shadow-sm transition-colors hover:bg-[color:var(--surface)] hover:text-[color:var(--ink)]"
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
                  className="w-60 overflow-hidden rounded-lg border-[color:var(--ink)]/10 bg-[color:var(--surface)] p-0 shadow-xl"
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
                className="hidden text-[15px] font-semibold text-[color:var(--ink)] transition-colors hover:text-[color:var(--brand-link)] sm:inline"
              >
                {t("nav.sign_in")}
              </Link>
              <Link to="/auth" search={{ mode: "sign_up" }} className="hidden sm:block">
                <Button
                  variant="solid"
                  color="blue"
                  className="h-11 rounded-full px-6 text-[15px] font-semibold shadow-sm transition-all duration-200 hover:shadow-md"
                >
                  {t("nav.sign_up")}
                </Button>
              </Link>
            </>
          )}
          <StaggeredMobileMenu
            items={mobileItems}
            socialItems={[
              { label: "LinkedIn", link: "https://www.linkedin.com/company/matchmax/" },
              { label: "Instagram", link: "https://www.instagram.com/match_max/" },
              { label: "Email", link: "mailto:contact@matchmax.hk" },
            ]}
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
                        className="h-10 w-full rounded-full text-sm font-semibold shadow-sm"
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
      <AnnouncementBanner />
    </header>
  );
}
