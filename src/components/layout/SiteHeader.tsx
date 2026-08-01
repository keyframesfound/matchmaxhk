import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Menu, X, ChevronDown } from "lucide-react";
import { useState } from "react";

import { LanguageToggle } from "@/components/brand/LanguageToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/useAuth";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SiteHeader() {
  const { t } = useTranslation();
  const { user, signOut, hasAnyRole } = useAuth();

  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = hasAnyRole(["admin", "super_admin"]);

  const closeMobile = () => setMobileOpen(false);

  const blurActive = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#041344]/10 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-[76px] max-w-[1440px] items-center px-5 sm:px-8 lg:px-10">
        {/* -------------------------------------------------- */}
        {/* Logo */}
        {/* -------------------------------------------------- */}

        <Link
          to="/"
          className="shrink-0"
          onClick={blurActive}
          aria-label="MatchMax home"
        >
          <span className="text-xl font-bold tracking-tight text-brand-gradient">
            MatchMax
          </span>
        </Link>

        {/* -------------------------------------------------- */}
        {/* Desktop Navigation */}
        {/* -------------------------------------------------- */}

        <nav className="ml-12 hidden items-center gap-9 lg:flex">
          <a
            href="/#how"
            className="group relative text-[15px] font-semibold text-[#041344]/85 transition-colors duration-200 hover:text-[#1FA8B6]"
          >
            {t("About")}

            <span className="absolute -bottom-2 left-0 h-[2px] w-0 rounded-full bg-[#1FA8B6] transition-all duration-200 group-hover:w-full" />
          </a>

          <Link
            to="/tutors"
            className="group relative text-[15px] font-semibold text-[#041344]/85 transition-colors duration-200 hover:text-[#1FA8B6]"
          >
            {t("nav.find")}

            <span className="absolute -bottom-2 left-0 h-[2px] w-0 rounded-full bg-[#1FA8B6] transition-all duration-200 group-hover:w-full" />
          </Link>

          <Link
            to="/become-a-tutor"
            className="group relative text-[15px] font-semibold text-[#041344]/85 transition-colors duration-200 hover:text-[#1FA8B6]"
          >
            {t("tutors_cta.cta")}

            <span className="absolute -bottom-2 left-0 h-[2px] w-0 rounded-full bg-[#1FA8B6] transition-all duration-200 group-hover:w-full" />
          </Link>
        </nav>

        {/* -------------------------------------------------- */}
        {/* Right Side */}
        {/* -------------------------------------------------- */}

        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          {/* Language */}
          <div className="flex items-center">
            <LanguageToggle />
          </div>

          {/* User */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="
                    h-10
                    gap-2
                    rounded-full
                    px-4
                    font-semibold
                    text-[#041344]
                    hover:bg-[#77E8EE]/20
                    hover:text-[#041344]
                  "
                >
                  <span className="max-w-[120px] truncate">
                    {user.email?.split("@")[0] ?? "Account"}
                  </span>

                  <ChevronDown className="h-4 w-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="w-60 rounded-2xl border-[#041344]/10 bg-white p-2 shadow-xl"
              >
                <DropdownMenuLabel className="px-3 py-2">
                  <div className="text-xs font-medium text-[#041344]/50">
                    Signed in as
                  </div>

                  <div className="mt-1 truncate text-sm font-semibold text-[#041344]">
                    {user.email}
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  asChild
                  className="
                    cursor-pointer
                    rounded-xl
                    px-3
                    py-2.5
                    font-medium
                    text-[#041344]
                    focus:bg-[#77E8EE]/20
                    focus:text-[#041344]
                  "
                >
                  <Link to="/dashboard">
                    {t("nav.dashboard")}
                  </Link>
                </DropdownMenuItem>

                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      asChild
                      className="
                        cursor-pointer
                        rounded-xl
                        px-3
                        py-2.5
                        font-medium
                        text-[#041344]
                        focus:bg-[#77E8EE]/20
                      "
                    >
                      <Link to="/admin/tutors">
                        Manage tutors
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      asChild
                      className="
                        cursor-pointer
                        rounded-xl
                        px-3
                        py-2.5
                        font-medium
                        text-[#041344]
                        focus:bg-[#77E8EE]/20
                      "
                    >
                      <Link to="/admin/users">
                        {t("nav.admin")}
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onSelect={() => void signOut()}
                  className="
                    cursor-pointer
                    rounded-xl
                    px-3
                    py-2.5
                    font-medium
                    text-[#041344]
                    focus:bg-red-50
                    focus:text-red-600
                  "
                >
                  {t("nav.sign_out")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              {/* Log in */}
              <Link
                to="/auth"
                className="
                  hidden
                  text-[15px]
                  font-semibold
                  text-[#041344]
                  transition-colors
                  hover:text-[#1FA8B6]
                  sm:inline
                "
              >
                {t("nav.sign_in")}
              </Link>

              {/* Sign up */}
              <Link to="/auth" className="hidden sm:block">
                <Button
                  className="
                    h-11
                    rounded-full
                    bg-[#0A245F]
                    px-6
                    text-[15px]
                    font-semibold
                    text-white
                    shadow-sm
                    transition-all
                    duration-200
                    hover:bg-[#041344]
                    hover:shadow-md
                  "
                >
                  Sign up
                </Button>
              </Link>
            </>
          )}

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-full
              border
              border-[#041344]/10
              bg-[#F8FCFE]
              text-[#041344]
              shadow-sm
              transition-all
              hover:border-[#1FA8B6]/30
              hover:bg-[#77E8EE]/20
              hover:text-[#041344]
              lg:hidden
            "
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* -------------------------------------------------- */}
      {/* Mobile Navigation */}
      {/* -------------------------------------------------- */}

      {mobileOpen && (
        <div className="border-t border-[#041344]/10 bg-white/95 backdrop-blur-sm shadow-[0_12px_40px_rgba(4,19,68,0.10)] lg:hidden">
          <nav className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-4 sm:px-8 sm:py-5">
            <div className="mb-1 flex items-center rounded-full border border-[#041344]/10 bg-[#F8FCFE] px-3 py-2.5 shadow-sm">
              <LanguageToggle />
            </div>

            <div className="grid gap-2">
              <a
                href="/#how"
                onClick={closeMobile}
                className="
                  flex
                  items-center
                  justify-between
                  rounded-full
                  border
                  border-[#041344]/10
                  bg-white
                  px-4
                  py-3
                  text-[15px]
                  font-semibold
                  text-[#041344]
                  shadow-sm
                  transition-all
                  hover:border-[#1FA8B6]/25
                  hover:bg-[#77E8EE]/20
                  hover:text-[#041344]
                "
              >
                <span>{t("About")}</span>
                <span className="text-sm text-[#1FA8B6]">↗</span>
              </a>

              <Link
                to="/tutors"
                onClick={closeMobile}
                className="
                  flex
                  items-center
                  justify-between
                  rounded-full
                  border
                  border-[#041344]/10
                  bg-white
                  px-4
                  py-3
                  text-[15px]
                  font-semibold
                  text-[#041344]
                  shadow-sm
                  transition-all
                  hover:border-[#1FA8B6]/25
                  hover:bg-[#77E8EE]/20
                  hover:text-[#041344]
                "
              >
                <span>{t("nav.find")}</span>
                <span className="text-sm text-[#1FA8B6]">↗</span>
              </Link>

              <Link
                to="/become-a-tutor"
                onClick={closeMobile}
                className="
                  flex
                  items-center
                  justify-between
                  rounded-full
                  border
                  border-[#041344]/10
                  bg-white
                  px-4
                  py-3
                  text-[15px]
                  font-semibold
                  text-[#041344]
                  shadow-sm
                  transition-all
                  hover:border-[#1FA8B6]/25
                  hover:bg-[#77E8EE]/20
                  hover:text-[#041344]
                "
              >
                <span>{t("tutors_cta.cta")}</span>
                <span className="text-sm text-[#1FA8B6]">↗</span>
              </Link>
            </div>

            {!user ? (
              <div className="mt-2 grid gap-2 border-t border-[#041344]/10 pt-4">
                <Link
                  to="/auth"
                  onClick={closeMobile}
                  className="
                    flex
                    items-center
                    justify-center
                    rounded-full
                    border
                    border-[#041344]/10
                    bg-[#F8FCFE]
                    px-4
                    py-3
                    text-[15px]
                    font-semibold
                    text-[#041344]
                    shadow-sm
                    transition-all
                    hover:border-[#1FA8B6]/25
                    hover:bg-[#77E8EE]/20
                  "
                >
                  {t("nav.sign_in")}
                </Link>

                <Link to="/auth" onClick={closeMobile} className="block">
                  <Button
                    className="
                      h-11
                      w-full
                      rounded-full
                      bg-[#0A245F]
                      text-[15px]
                      font-semibold
                      text-white
                      shadow-sm
                      transition-all
                      duration-200
                      hover:bg-[#041344]
                      hover:shadow-md
                    "
                  >
                    Sign up
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="mt-2 border-t border-[#041344]/10 pt-4">
                <Link
                  to="/dashboard"
                  onClick={closeMobile}
                  className="
                    flex
                    items-center
                    justify-center
                    rounded-full
                    border
                    border-[#041344]/10
                    bg-[#F8FCFE]
                    px-4
                    py-3
                    text-[15px]
                    font-semibold
                    text-[#041344]
                    shadow-sm
                    transition-all
                    hover:border-[#1FA8B6]/25
                    hover:bg-[#77E8EE]/20
                  "
                >
                  {t("nav.dashboard")}
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}