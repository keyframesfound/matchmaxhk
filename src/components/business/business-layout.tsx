import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BookOpen, ExternalLink, LayoutDashboard, Settings, UsersRound } from "lucide-react";

import { ConsoleShell, type ConsoleNavGroup } from "@/components/layout/console-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/useAuth";
import type { Organization, OrgUsage } from "@/features/business/useMyOrganization";

export const BUSINESS_TABS = [
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
            nearLimit ? "bg-amber-500" : "bg-[#1d9bf0]",
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
  const { user, signOut } = useAuth();
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

  const groups: ConsoleNavGroup[] = [
    {
      label: "Console",
      items: BUSINESS_TABS.map((item) => ({
        label: item.label,
        icon: item.icon,
        active: activeTabName === item.tab,
        onSelect: () => switchTab(item.tab),
      })),
    },
  ];

  const accountName =
    user?.user_metadata.display_name?.trim() || user?.email?.split("@")[0] || "Business account";

  return (
    <ConsoleShell
      className="min-h-[calc(100vh-64px)] flex-1"
      size="comfortable"
      brandMark={
        organization.logo_url ? (
          <img
            src={organization.logo_url}
            alt=""
            className="size-6 rounded-md border border-border object-cover"
          />
        ) : (
          <span className="flex size-6 items-center justify-center rounded-md bg-[color:var(--foreground)] text-[color:var(--background)] text-[11px] font-bold">
            {initials || "MM"}
          </span>
        )
      }
      brandLabel={organization.name}
      groups={groups}
      title={activeTabName.charAt(0).toUpperCase() + activeTabName.slice(1)}
      headerExtra={
        <>
          <PlanBadge plan={organization.plan} />
          <a
            href={`/business/${organization.slug}`}
            target="_blank"
            rel="noreferrer"
            className="hidden text-xs text-muted-foreground hover:text-[color:var(--brand-link)] hover:underline md:inline"
          >
            matchmax.hk/business/{organization.slug}
          </a>
          <Button asChild variant="outline" size="sm">
            <a href={`/business/${organization.slug}`} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1.5 h-4 w-4" />
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
            Account
          </Button>
        </>
      }
      sidebarExtra={
        <div className="grid gap-3">
          {usage ? (
            <UsageMeter used={usage.coursesUsed} limit={usage.courseLimit} label="Courses posted" />
          ) : null}
          <Button asChild variant="outline" size="sm" className="w-full">
            <a href={`/business/${organization.slug}`} target="_blank" rel="noreferrer">
              View public profile
            </a>
          </Button>
        </div>
      }
      account={{
        name: accountName,
        email: user?.email ?? "",
        avatarUrl: (user?.user_metadata.avatar_url as string | undefined) ?? null,
      }}
      onSignOut={() => void signOut()}
    >
      {children}
    </ConsoleShell>
  );
}
