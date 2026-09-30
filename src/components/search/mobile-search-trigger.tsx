import { Search } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

/**
 * Mobile Airbnb-style search entry: a shadow-elevated "Start your search"
 * bar above the quick-nav pills row (Case / How it works / Become tutor)
 * that doubles as the mobile top navigation. The block bleeds to the true
 * screen edges (canceling the parent px-4/px-6 container) and the pills row
 * scrolls with cut-off pills touching the screen edge, like Airbnb. The
 * pill shadows live in styles.css (`.pill-elevate*`) — the one sanctioned
 * exception to the flat-design rule.
 */
export function MobileSearchTrigger({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);

  const navPills = [
    {
      key: "case",
      label: t("nav_mobile.case"),
      to: "/tutor-requests" as const,
      icon: "/nav-case-board.png",
    },
    {
      key: "how",
      label: t("nav.how"),
      to: "/how-it-works" as const,
      icon: "/nav-how-it-works.png",
    },
    {
      key: "join",
      label: t("nav.become_tutor"),
      to: "/join" as const,
      icon: "/nav-become-tutor.png",
    },
  ];

  return (
    <div className={cn("-mx-4 px-3 md:-mx-6 lg:hidden", className)}>
      <button
        type="button"
        onClick={onClick}
        className="pill-elevate-lg flex w-full items-center justify-center gap-2.5 rounded-full border border-transparent bg-card px-4 py-3.5 text-base font-semibold text-[color:var(--ink)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:border-border"
      >
        <Search className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </button>
      <nav
        aria-label={t("nav_mobile.quick_links")}
        className="-mx-3 mt-3 flex items-stretch gap-2 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none] [scroll-padding-left:12px] [&::-webkit-scrollbar]:hidden"
      >
        {navPills.map((pill) => {
          const active = isActive(pill.to);
          return (
            <Link
              key={pill.key}
              to={pill.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "pill-elevate flex shrink-0 items-center justify-center rounded-full border px-3.5 py-2.5 text-sm whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
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
                  className="h-[18px] w-[18px] shrink-0 dark:invert-[0.85] dark:hue-rotate-180"
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
