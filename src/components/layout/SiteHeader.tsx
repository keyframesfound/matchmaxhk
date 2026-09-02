import { Link } from "@tanstack/react-router";
import { ChevronDown, CircleHelp, LogOut, Moon, Settings, Sun, UserRound } from "lucide-react";
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
import { useTheme } from "@/features/theme/ThemeProvider";

import { AnnouncementBanner } from "./AnnouncementBanner";
import { StaggeredMobileMenu } from "./StaggeredMobileMenu";

export function SiteHeader({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { user, signOut, hasAnyRole } = useAuth();
  const { theme, setTheme } = useTheme();
  const isAdmin = hasAnyRole(["admin", "super_admin"]);
  const accountName = user?.user_metadata.display_name?.trim() || user?.email?.split("@")[0] || "Account";
  const accountInitial = accountName.charAt(0).toUpperCase();
  const useDarkTheme = theme !== "dark";
  const brandLabelClassName = "text-lg font-bold tracking-tight text-brand-gradient sm:text-xl";
  const mobileItems = [
    { label: t("How it works"), ariaLabel: t("How it works"), to: "/how-it-works" },
    {
      label: t("nav.find", { defaultValue: "Find" }),
      ariaLabel: t("nav.find", { defaultValue: "Find" }),
      to: "/tutors",
    },
    { label: "Saved Posts", ariaLabel: "Saved Posts", to: "/saved-posts" },
    { label: "Become a Tutor", ariaLabel: "Become a Tutor", to: "/join" },
    { label: "Help Centre", ariaLabel: "Help Centre", to: "/faq" },
    ...(user ? [{ label: "Settings", ariaLabel: "Settings", to: "/dashboard" }] : []),
    ...(isAdmin
      ? [
          { label: "Manage tutors", ariaLabel: "Manage tutors", to: "/admin/tutors" },
          { label: t("nav.admin"), ariaLabel: t("nav.admin"), to: "/admin/users" },
          { label: "R2 images", ariaLabel: "R2 images", to: "/admin/r2" },
        ]
      : []),
  ];

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b border-[color:var(--ink)]/10 bg-[color:var(--surface)]/95 backdrop-blur-sm ${className ?? ""}`}
    >
      <div className="mx-auto flex h-[64px] max-w-[1440px] items-center px-4 sm:px-8 lg:px-10">
        <Link to="/" className="flex shrink-0 items-center" aria-label="MatchMax home">
          <div className="flex items-center gap-2">
            <Logo className="shrink-0" />
            <span className={brandLabelClassName}>MatchMax</span>
          </div>
        </Link>

        <nav className="ml-12 hidden items-center gap-9 lg:flex">
          <a
            href="/how-it-works"
            className="group relative text-[15px] font-semibold text-[color:var(--ink)]/85 transition-colors duration-200 hover:text-[color:var(--brand-link)]"
          >
            {t("How it works")}
            <span className="absolute -bottom-2 left-0 h-[2px] w-0 rounded-full bg-[color:var(--surface-invert-hover)] transition-all duration-200 group-hover:w-full" />
          </a>
          <Link
            to="/tutors"
            className="group relative text-[15px] font-semibold text-[color:var(--ink)]/85 transition-colors duration-200 hover:text-[color:var(--brand-link)]"
          >
            {t("nav.find", { defaultValue: "Find" })}
            <span className="absolute -bottom-2 left-0 h-[2px] w-0 rounded-full bg-[color:var(--surface-invert-hover)] transition-all duration-200 group-hover:w-full" />
          </Link>
          <Link
            to="/saved-posts"
            className="group relative text-[15px] font-semibold text-[color:var(--ink)]/85 transition-colors duration-200 hover:text-[color:var(--brand-link)]"
          >
            Saved Posts
            <span className="absolute -bottom-2 left-0 h-[2px] w-0 rounded-full bg-[color:var(--surface-invert-hover)] transition-all duration-200 group-hover:w-full" />
          </Link>
          <Link
            to="/join"
            className="group relative text-[15px] font-semibold text-[color:var(--ink)]/85 transition-colors duration-200 hover:text-[color:var(--brand-link)]"
          >
            Become a Tutor
            <span className="absolute -bottom-2 left-0 h-[2px] w-0 rounded-full bg-[color:var(--surface-invert-hover)] transition-all duration-200 group-hover:w-full" />
          </Link>
          <Link
            to="/faq"
            className="group relative text-[15px] font-semibold text-[color:var(--ink)]/85 transition-colors duration-200 hover:text-[color:var(--brand-link)]"
          >
            Help Centre
            <span className="absolute -bottom-2 left-0 h-[2px] w-0 rounded-full bg-[color:var(--surface-invert-hover)] transition-all duration-200 group-hover:w-full" />
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <div className="flex items-center">
            <LanguageToggle />
          </div>
          {user ? (
            <div className="hidden lg:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-11 w-60 justify-start gap-2 rounded-lg border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] px-2 text-left text-[color:var(--ink)] shadow-sm transition-colors hover:bg-[color:var(--surface)] hover:text-[color:var(--ink)]"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1FA8B6] text-xs font-bold text-white">
                      {accountInitial}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold leading-4">{accountName}</span>
                      <span className="block truncate text-xs font-normal leading-4 text-[color:var(--ink)]/55">
                        {user.email}
                      </span>
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--ink)]/45" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-60 rounded-lg border-[color:var(--ink)]/10 bg-[color:var(--surface)] p-1.5 shadow-xl"
                >
                  <DropdownMenuLabel className="px-3 py-2.5">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--ink)]/50">
                      MatchMax account
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold text-[color:var(--ink)]">{accountName}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    asChild
                    className="cursor-pointer rounded-md px-3 py-2.5 font-medium text-[color:var(--ink)] focus:bg-[#77E8EE]/20 focus:text-[color:var(--ink)]"
                  >
                    <a href="/dashboard#profile">
                      <UserRound aria-hidden="true" />
                      Profile
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    asChild
                    className="cursor-pointer rounded-md px-3 py-2.5 font-medium text-[color:var(--ink)] focus:bg-[#77E8EE]/20 focus:text-[color:var(--ink)]"
                  >
                    <a href="/dashboard">
                      <Settings aria-hidden="true" />
                      Settings
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setTheme(useDarkTheme ? "dark" : "light")}
                    className="cursor-pointer rounded-md px-3 py-2.5 font-medium text-[color:var(--ink)] focus:bg-[#77E8EE]/20 focus:text-[color:var(--ink)]"
                  >
                    {useDarkTheme ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
                    {useDarkTheme ? "Dark mode" : "Light mode"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    asChild
                    className="cursor-pointer rounded-md px-3 py-2.5 font-medium text-[color:var(--ink)] focus:bg-[#77E8EE]/20 focus:text-[color:var(--ink)]"
                  >
                    <Link to="/faq">
                      <CircleHelp aria-hidden="true" />
                      Help Centre
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        asChild
                        className="cursor-pointer rounded-md px-3 py-2.5 font-medium text-[color:var(--ink)] focus:bg-[#77E8EE]/20"
                      >
                        <Link to="/admin/tutors">Manage tutors</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        asChild
                        className="cursor-pointer rounded-md px-3 py-2.5 font-medium text-[color:var(--ink)] focus:bg-[#77E8EE]/20"
                      >
                        <Link to="/admin/r2">R2 images</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        asChild
                        className="cursor-pointer rounded-md px-3 py-2.5 font-medium text-[color:var(--ink)] focus:bg-[#77E8EE]/20"
                      >
                        <Link to="/admin/users">{t("nav.admin")}</Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => void signOut()}
                    className="cursor-pointer rounded-md px-3 py-2.5 font-medium text-[color:var(--ink)] focus:bg-red-50 focus:text-red-600"
                  >
                    <LogOut aria-hidden="true" />
                    {t("nav.sign_out")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <>
              <Link
                to="/auth"
                className="hidden text-[15px] font-semibold text-[color:var(--ink)] transition-colors hover:text-[#1FA8B6] sm:inline"
              >
                {t("nav.sign_in")}
              </Link>
              <Link to="/auth" search={{ mode: "sign_up" }} className="hidden sm:block">
                <Button className="h-11 rounded-full bg-[color:var(--surface-invert)] px-6 text-[15px] font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[color:var(--surface-invert)] hover:shadow-md">
                  Sign up
                </Button>
              </Link>
            </>
          )}
          <StaggeredMobileMenu
            items={mobileItems}
            socialItems={[
              { label: "LinkedIn", link: "https://www.linkedin.com/company/matchmax/" },
              { label: "Instagram", link: "https://www.instagram.com/match_max/" },
              { label: "Email", link: "mailto:matchmaxedu@gmail.com" },
            ]}
            renderFooter={(closeMenu) => (
              <div className="flex flex-col gap-3">
                {!user ? (
                  <>
                    <Link to="/auth" onClick={closeMenu}>
                      <Button
                        variant="outline"
                        className="h-10 w-full rounded-full border-[color:var(--ink)]/15 text-sm font-semibold text-[color:var(--ink)] hover:bg-[#77E8EE]/20 hover:text-[color:var(--ink)]"
                      >
                        {t("nav.sign_in")}
                      </Button>
                    </Link>
                    <Link to="/auth" search={{ mode: "sign_up" }} onClick={closeMenu}>
                      <Button className="h-10 w-full rounded-full bg-[color:var(--surface-invert)] text-sm font-semibold text-white shadow-sm hover:bg-[color:var(--surface-invert)]">
                        Sign up
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
                    className="h-10 w-full rounded-full border border-[color:var(--ink)]/15 text-sm font-semibold text-[color:var(--ink)] transition-colors hover:bg-red-50 hover:text-red-600"
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
