import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
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

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-6">
        <Link to="/" className="shrink-0">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          <a href="/#how" className="text-sm font-semibold text-foreground/80 transition-colors hover:text-[color:var(--brand-teal)]">
            {t("nav.how_it_works")}
          </a>
          <Link to="/tutors" className="text-sm font-semibold text-foreground/80 transition-colors hover:text-[color:var(--brand-teal)]">
            {t("nav.find_tutor")}
          </Link>
          <Link to="/become-a-tutor" className="text-sm font-semibold text-foreground/80 transition-colors hover:text-[color:var(--brand-teal)]">
            {t("tutors_cta.cta")}
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageToggle />

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 font-semibold">
                  {user.email?.split("@")[0] ?? "Account"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard">{t("nav.dashboard")}</Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/admin/tutors">Manage tutors</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/admin/users">{t("nav.admin")}</Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void signOut()}>
                  {t("nav.sign_out")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link to="/auth" className="hidden text-sm font-bold text-foreground/90 hover:text-[color:var(--brand-teal)] sm:inline">
                {t("nav.sign_in")}
              </Link>
              <Button asChild size="sm" className="h-9 bg-[color:var(--brand-navy)] font-bold text-white hover:bg-[color:var(--brand-royal)]">
                <Link to="/auth">{t("nav.post_case")}</Link>
              </Button>
            </>
          )}

          <button
            className="ml-1 flex h-9 w-9 items-center justify-center rounded-md border border-border lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-border bg-background lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            <a href="/#how" className="rounded-md px-3 py-2 text-sm font-semibold hover:bg-muted" onClick={() => setMobileOpen(false)}>
              {t("nav.how_it_works")}
            </a>
            <Link to="/tutors" className="rounded-md px-3 py-2 text-sm font-semibold hover:bg-muted" onClick={() => setMobileOpen(false)}>
              {t("nav.find_tutor")}
            </Link>
            <Link to="/become-a-tutor" className="rounded-md px-3 py-2 text-sm font-semibold hover:bg-muted" onClick={() => setMobileOpen(false)}>
              {t("tutors_cta.cta")}
            </Link>
            {!user && (
              <Link to="/auth" className="rounded-md px-3 py-2 text-sm font-semibold hover:bg-muted" onClick={() => setMobileOpen(false)}>
                {t("nav.sign_in")}
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
