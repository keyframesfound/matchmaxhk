import { Search, SlidersHorizontal } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

/**
 * Mobile Airbnb-style search entry: a shadow-elevated "Start your search"
 * bar above the quick-nav pills row (Marketplace / Case / Calendar / Become a Tutor)
 * that doubles as the mobile top navigation. The block bleeds to the true
 * screen edges (canceling the parent px-4/px-6 container) and the pills row
 * scrolls with cut-off pills touching the screen edge, like Airbnb. The
 * pill shadows live in styles.css (`.pill-elevate*`), the one sanctioned
 * exception to the flat-design rule.
 */
export function MobileSearchTrigger({
  label,
  subtitle,
  badgeCount,
  onClick,
  className,
}: {
  label: string;
  /** #605 §3.2: second line summarising the active constraints. */
  subtitle?: string;
  /** #605: active filter count on the right-hand filter badge. */
  badgeCount?: number;
  onClick: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const search = useRouterState({ select: (state) => state.location.searchStr ?? "" });
  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);

  // #594 CEO lock (2026-11-03), owner order: phone pills L→R Marketplace ·
  // Case · Manage · Become a Tutor (Manage = Case Manager, /calendar). Guide lives in the menu / Help (as on Mac).
  const notesActive = pathname === "/tutors" && search.includes("view=materials");
  const navPills: {
    key: string;
    label: string;
    to: "/tutors" | "/tutor-requests" | "/join" | "/calendar";
    search?: { view: "materials" };
    icon: string;
    active: boolean;
  }[] = [
    {
      key: "marketplace",
      label: t("nav_mobile.marketplace"),
      to: "/tutors",
      search: { view: "materials" },
      icon: "/nav-marketplace.png",
      active: notesActive,
    },
    {
      key: "case",
      label: t("nav_mobile.case"),
      to: "/tutor-requests",
      icon: "/nav-case-board.png",
      active: isActive("/tutor-requests"),
    },
    {
      key: "calendar",
      label: t("nav.tab_calendar"),
      to: "/calendar",
      icon: "/nav-manage.png",
      active: isActive("/calendar"),
    },
    {
      key: "join",
      label: t("nav.become_tutor"),
      to: "/join",
      icon: "/nav-become-tutor.png",
      active: isActive("/join"),
    },
  ];

  return (
    <div className={cn("-mx-4 px-3 md:-mx-6 lg:hidden", className)}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "pill-elevate-lg flex w-full items-center justify-center gap-2.5 rounded-full border border-transparent bg-card px-4 text-base font-medium text-[color:var(--ink)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-border",
          subtitle ? "py-2" : "py-3.5",
        )}
      >
        <Search className="h-5 w-5 shrink-0" aria-hidden="true" />
        {subtitle ? (
          <span className="min-w-0 flex-1 text-left leading-tight">
            <span className="block truncate text-[15px] font-semibold">{label}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {subtitle}
            </span>
          </span>
        ) : (
          <span className="truncate">{label}</span>
        )}
        {subtitle !== undefined ? (
          <span
            aria-label={badgeCount ? String(badgeCount) : undefined}
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            {badgeCount ? (
              <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[color:var(--ink)] px-1 text-[10px] font-bold text-[color:var(--background)]">
                {badgeCount}
              </span>
            ) : null}
          </span>
        ) : null}
      </button>
      <nav
        aria-label={t("nav_mobile.quick_links")}
        className="-mx-3 mt-3 flex items-stretch gap-2 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none] [scroll-padding-left:12px] [&::-webkit-scrollbar]:hidden"
      >
        {navPills.map((pill) => {
          const active = pill.active;
          return (
            <Link
              key={pill.key}
              to={pill.to}
              {...(pill.search ? { search: pill.search } : {})}
              aria-current={active ? "page" : undefined}
              className={cn(
                "pill-elevate flex shrink-0 items-center justify-center rounded-full border px-3.5 py-2.5 text-sm whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active &&
                  "pill-elevate-strong border-transparent bg-muted font-bold text-[color:var(--ink)] dark:border-[color:var(--foreground)] dark:bg-card",
                !active &&
                  "border-transparent bg-card font-medium text-[color:var(--ink)]/75 hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--ink)] dark:border-border",
              )}
            >
              <span className="flex items-center justify-center gap-2">
                <img
                  src={pill.icon}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="h-[22px] w-[22px] shrink-0 dark:invert-[0.85] dark:hue-rotate-180"
                />
                <span>{pill.label}</span>
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
