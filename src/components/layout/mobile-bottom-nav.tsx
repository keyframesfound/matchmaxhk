import { Link, useRouterState } from "@tanstack/react-router";
import { Bookmark, CircleUserRound, Compass } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

const tabButtonClass =
  "relative flex flex-1 flex-col items-center gap-1 px-2 py-2.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

/**
 * Fixed mobile bottom navigation: Explore, Saved and Account (the Account
 * tab opens the Account hub page, /me, #594).
 * Hidden on lg+ where the desktop header takes over.
 */
export function MobileBottomNav() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  // OS Reduce Motion must silence the sliding indicators too (#398 review):
  // layoutId springs are transform/layout animations, which motion plays
  // regardless of the media query unless gated here.
  const prefersReducedMotion = useReducedMotion();

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
          {/* #594 (2026-11-04): Account opens the full Account hub page. */}
          <Link
            to="/me"
            aria-current={isActive("/me") ? "page" : undefined}
            className={cn(
              tabButtonClass,
              isActive("/me") ? "text-[color:var(--ink)]" : "text-[color:var(--ink)]/60",
            )}
          >
            <CircleUserRound className="h-5 w-5" aria-hidden="true" />
            {t("nav_mobile.account")}
          </Link>
        </div>
      </nav>
    </>
  );
}
