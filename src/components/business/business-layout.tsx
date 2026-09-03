import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  Building2,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Settings,
  UsersRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Organization, OrgUsage } from "@/features/business/useMyOrganization";

const NAV_ITEMS = [
  { label: "Overview", tab: "overview", icon: LayoutDashboard },
  { label: "Courses", tab: "courses", icon: BookOpen },
  { label: "Team", tab: "team", icon: UsersRound },
  { label: "Profile", tab: "profile", icon: Settings },
] as const;

export function PlanBadge({ plan }: { plan: Organization["plan"] }) {
  const isEnterprise = plan === "enterprise";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        isEnterprise
          ? "bg-violet-50 text-violet-700 ring-violet-700/10 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-400/20"
          : "bg-blue-50 text-blue-700 ring-blue-700/10 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-400/20",
      )}
    >
      {isEnterprise ? "Enterprise" : "Business"}
    </span>
  );
}

export function UsageMeter({
  used,
  limit,
  label,
}: {
  used: number;
  limit: number | null;
  label: string;
}) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const nearLimit = limit !== null && used >= limit;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p
          className={cn(
            "text-xs font-semibold",
            nearLimit ? "text-amber-600" : "text-[color:var(--ink)]",
          )}
        >
          {limit === null ? `${used} · unlimited` : `${used} / ${limit}`}
        </p>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            nearLimit ? "bg-amber-500" : "bg-[#1FA8B6]",
          )}
          style={{ width: limit ? `${pct}%` : "100%" }}
        />
      </div>
    </div>
  );
}

type BusinessLayoutProps = {
  organization: Organization;
  usage: OrgUsage | null;
  children: ReactNode;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
};

export function BusinessLayout({
  organization,
  usage,
  children,
  activeTab,
  onTabChange,
}: BusinessLayoutProps) {
  const navigate = useNavigate();
  const activeTabName = activeTab ?? "overview";
  const initials = organization.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");

  const switchTab = (tab: string) => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      navigate({ to: "/business", search: { tab } });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 bg-muted/40">
      <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-14 items-center gap-2.5 border-b border-border px-5">
          {organization.logo_url ? (
            <img
              src={organization.logo_url}
              alt=""
              className="h-8 w-8 rounded-lg border border-border object-cover"
            />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1FA8B6] text-sm font-bold text-white">
              {initials || "MM"}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[color:var(--ink)]">
              {organization.name}
            </p>
            <p className="text-xs text-muted-foreground">Business console</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-3">
          {NAV_ITEMS.map((item) => {
            const active = activeTabName === item.tab;
            return (
              <button
                key={item.tab}
                type="button"
                onClick={() => switchTab(item.tab)}
                aria-current={active}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-[color:var(--brand-teal)]/10 font-semibold text-[color:var(--ink)]"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-[color:var(--ink)]",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-border p-4">
          {usage && (
            <div className="mb-4">
              <UsageMeter
                used={usage.coursesUsed}
                limit={usage.courseLimit}
                label="Courses posted"
              />
            </div>
          )}
          <Button asChild variant="outline" size="sm" className="w-full">
            <a href={`/business/${organization.slug}`} target="_blank" rel="noreferrer">
              View public profile
            </a>
          </Button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-border bg-card/95 px-4 backdrop-blur sm:px-8">
          <div className="flex min-w-0 items-center gap-3 lg:hidden">
            <Link to="/business" search={{ tab: undefined }} className="flex items-center gap-2">
              {organization.logo_url ? (
                <img
                  src={organization.logo_url}
                  alt=""
                  className="h-6 w-6 rounded-md border border-border object-cover"
                />
              ) : (
                <Building2 className="h-5 w-5 text-[#1FA8B6]" />
              )}
              <span className="truncate text-sm font-bold text-[color:var(--ink)]">
                {organization.name}
              </span>
            </Link>
          </div>
          <div className="hidden items-center gap-3 lg:flex">
            <PlanBadge plan={organization.plan} />
            <span className="h-4 w-px bg-border" />
            <a
              href={`/business/${organization.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground hover:text-[color:var(--brand-link)] hover:underline"
            >
              matchmax.hk/business/{organization.slug}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <a href={`/business/${organization.slug}`} target="_blank" rel="noreferrer">
                Public site
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigate({ to: "/dashboard" });
              }}
            >
              <LogOut className="mr-1.5 h-4 w-4" />
              Account
            </Button>
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card px-4 py-2 lg:hidden">
          {NAV_ITEMS.map((item) => {
            const active = activeTabName === item.tab;
            return (
              <button
                key={item.tab}
                type="button"
                onClick={() => switchTab(item.tab)}
                aria-current={active}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-[color:var(--brand-teal)]/10 font-semibold text-[color:var(--ink)]"
                    : "text-muted-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <main id="main-content" className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-2 text-sm">
              <Link
                to="/business"
                search={{ tab: undefined }}
                className="font-medium text-muted-foreground transition-colors hover:text-[color:var(--ink)]"
              >
                Business
              </Link>
              <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
              <span className="font-medium text-[color:var(--ink)]">
                {activeTabName.charAt(0).toUpperCase() + activeTabName.slice(1)}
              </span>
            </nav>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
