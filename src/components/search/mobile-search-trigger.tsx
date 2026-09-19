import { Search } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

/**
 * Mobile Airbnb-style search entry: a bordered, card-backed "Start your
 * search" bar above the quick-nav pills row (Case / How it works / Become
 * tutor) that doubles as the mobile top navigation.
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
    { key: "case", label: t("nav_mobile.case"), to: "/tutor-requests" as const },
    { key: "how", label: t("nav.how"), to: "/how-it-works" as const },
    { key: "join", label: t("nav.become_tutor"), to: "/join" as const },
  ];

  return (
    <div className={cn("lg:hidden", className)}>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-[15px] font-semibold text-[color:var(--ink)] transition-colors hover:bg-[color:var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </button>
      <nav
        aria-label={t("nav_mobile.quick_links")}
        className="mt-1.5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {navPills.map((pill) => {
          const active = isActive(pill.to);
          return (
            <Link
              key={pill.key}
              to={pill.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                active
                  ? "border-[1.5px] border-[color:var(--foreground)] bg-card font-bold text-[color:var(--ink)]"
                  : "border-border bg-card font-medium text-[color:var(--ink)]/75 hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--ink)]",
              )}
            >
              {pill.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
