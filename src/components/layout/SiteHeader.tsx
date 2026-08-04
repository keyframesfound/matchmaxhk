import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Menu, X, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import { LanguageToggle } from "@/components/brand/LanguageToggle";
import { Logo } from "@/components/brand/Logo";
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

  // Lock body scroll while the full-screen mobile nav is open
  useEffect(() => {
    if (mobileOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [mobileOpen]);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-[#041344]/10 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center px-5 sm:px-8 lg:px-10">
          {/* -------------------------------------------------- */}
          {/* Logo */}
          {/* -------------------------------------------------- */}

          <Link
            to="/"
            className="flex shrink-0 items-center"
            onClick={blurActive}
            aria-label="MatchMax home"
          >
            <div className="flex items-center gap-2">
              <img
                src="/matchmax-logo.png"
                alt="MatchMax logo"
                className="h-9 w-9 object-contain"
              />
              <span className="text-xl font-bold tracking-tight text-brand-gradient">MatchMax</span>
            </div>
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
              {t("nav.find", { defaultValue: "Find" })}

              <span className="absolute -bottom-2 left-0 h-[2px] w-0 rounded-full bg-[#1FA8B6] transition-all duration-200 group-hover:w-full" />
            </Link>

            <Link
              to="/consulting"
              className="group relative text-[15px] font-semibold text-[#041344]/85 transition-colors duration-200 hover:text-[#1FA8B6]"
            >
              Consult

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
                    px-4
                    font-semibold
                    text-[#041344]
                    hover:bg-transparent
                    hover:text-[#1FA8B6]
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
                    <div className="text-xs font-medium text-[#041344]/50">Signed in as</div>

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
                    <Link to="/dashboard">{t("nav.dashboard")}</Link>
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
                        <Link to="/admin/tutors">Manage tutors</Link>
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
                        <Link to="/admin/users">{t("nav.admin")}</Link>
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
              rounded-xl
              items-center
              justify-center
              text-[#041344]
              transition-all
              hover:bg-transparent
              hover:text-[#1FA8B6]
              hover:text-[#041344]
              lg:hidden
            "
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* -------------------------------------------------- */}
      {/* Mobile Navigation — full-screen overlay              */}
      {/* -------------------------------------------------- */}

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white lg:hidden">
          {/* Top bar — mirrors the main header, brand colours kept */}
          <div className="flex h-[76px] shrink-0 items-center justify-between border-b border-[#041344]/10 px-5 sm:px-8">
            <Link
              to="/"
              className="flex shrink-0 items-center"
              onClick={() => {
                closeMobile();
                blurActive();
              }}
              aria-label="MatchMax home"
            >
              <div className="flex items-center gap-2">
                <img
                  src="/matchmax-logo.png"
                  alt="MatchMax logo"
                  className="h-8 w-8 object-contain"
                />
                <span className="text-lg font-bold tracking-tight text-brand-gradient">
                  MatchMax
                </span>
              </div>
            </Link>

            <button
              type="button"
              onClick={closeMobile}
              aria-label="Close menu"
              className="
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-full
                text-[#041344]
                transition-colors
                hover:bg-[#77E8EE]/20
              "
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex flex-1 flex-col overflow-y-auto px-5 sm:px-8">
            <nav className="flex flex-col">
              <a
                href="/#how"
                onClick={closeMobile}
                className="
                  flex
                  items-center
                  justify-between
                  border-b
                  border-[#041344]/10
                  py-6
                  text-[28px]
                  font-bold
                  leading-none
                  tracking-tight
                  text-[#041344]
                  transition-colors
                  active:text-[#1FA8B6]
                "
              >
                {t("About")}
              </a>

              <Link
                to="/tutors"
                onClick={closeMobile}
                className="
                  flex
                  items-center
                  justify-between
                  border-b
                  border-[#041344]/10
                  py-6
                  text-[28px]
                  font-bold
                  leading-none
                  tracking-tight
                  text-[#041344]
                  transition-colors
                  active:text-[#1FA8B6]
                "
              >
                {t("nav.find", { defaultValue: "Find" })}
              </Link>

              <Link
                to="/consulting"
                onClick={closeMobile}
                className="
                  flex
                  items-center
                  justify-between
                  border-b
                  border-[#041344]/10
                  py-6
                  text-[28px]
                  font-bold
                  leading-none
                  tracking-tight
                  text-[#041344]
                  transition-colors
                  active:text-[#1FA8B6]
                "
              >
                Consult
              </Link>

              <Link
                to="/become-a-tutor"
                onClick={closeMobile}
                className="
                  flex
                  items-center
                  justify-between
                  border-b
                  border-[#041344]/10
                  py-6
                  text-[28px]
                  font-bold
                  leading-none
                  tracking-tight
                  text-[#041344]
                  transition-colors
                  active:text-[#1FA8B6]
                "
              >
                {t("tutors_cta.cta")}
              </Link>

              {user && (
                <Link
                  to="/dashboard"
                  onClick={closeMobile}
                  className="
                    flex
                    items-center
                    justify-between
                    border-b
                    border-[#041344]/10
                    py-6
                    text-[28px]
                    font-bold
                    leading-none
                    tracking-tight
                    text-[#041344]
                    transition-colors
                    active:text-[#1FA8B6]
                  "
                >
                  {t("nav.dashboard")}
                </Link>
              )}

              {isAdmin && (
                <>
                  <Link
                    to="/admin/tutors"
                    onClick={closeMobile}
                    className="
                      flex
                      items-center
                      justify-between
                      border-b
                      border-[#041344]/10
                      py-6
                      text-[28px]
                      font-bold
                      leading-none
                      tracking-tight
                      text-[#041344]
                      transition-colors
                      active:text-[#1FA8B6]
                    "
                  >
                    Manage tutors
                  </Link>

                  <Link
                    to="/admin/users"
                    onClick={closeMobile}
                    className="
                      flex
                      items-center
                      justify-between
                      border-b
                      border-[#041344]/10
                      py-6
                      text-[28px]
                      font-bold
                      leading-none
                      tracking-tight
                      text-[#041344]
                      transition-colors
                      active:text-[#1FA8B6]
                    "
                  >
                    {t("nav.admin")}
                  </Link>
                </>
              )}
            </nav>

            {/* Bottom section — auth actions + language, pinned low like the reference */}
            <div className="mt-auto flex flex-col gap-3 py-8">
              {!user ? (
                <>
                  <Link to="/auth" onClick={closeMobile}>
                    <Button
                      variant="outline"
                      className="
                        h-12
                        w-full
                        rounded-full
                        border-[#041344]/15
                        text-[15px]
                        font-semibold
                        text-[#041344]
                        hover:bg-[#77E8EE]/20
                        hover:text-[#041344]
                      "
                    >
                      {t("nav.sign_in")}
                    </Button>
                  </Link>

                  <Link to="/auth" onClick={closeMobile}>
                    <Button
                      className="
                        h-12
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
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    void signOut();
                    closeMobile();
                  }}
                  className="
                    h-12
                    w-full
                    rounded-full
                    border
                    border-[#041344]/15
                    text-[15px]
                    font-semibold
                    text-[#041344]
                    transition-colors
                    hover:bg-red-50
                    hover:text-red-600
                  "
                >
                  {t("nav.sign_out")}
                </button>
              )}

              <div className="flex items-center justify-start pt-2">
                <LanguageToggle />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
