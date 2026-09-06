import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ExternalLink,
  Eye,
  MousePointerClick,
  Tag,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/business/empty-state";
import { BusinessLayout, UsageMeter } from "@/components/business/business-layout";
import { CoursesPanel } from "@/features/business/courses-panel";
import { TeamPanel } from "@/features/business/team-panel";
import { ProfilePanel } from "@/features/business/profile-panel";
import { useAuth } from "@/features/auth/useAuth";
import { useMyOrganization } from "@/features/business/useMyOrganization";
import {
  getBusinessAnalytics,
  type BusinessAnalytics,
} from "@/features/business/business.functions";
import {
  courseModeLabel,
  fetchCoursesByOrganizationId,
  formatCoursePrice,
} from "@/features/courses/queries";
import { cn } from "@/lib/utils";
import { CENTRE_MARKET_ENABLED } from "@/lib/feature-flags";

import { NotFoundComponent } from "./__root";

export const Route = createFileRoute("/_authenticated/business/")({
  validateSearch: (search: Record<string, unknown>) => {
    const tab = typeof search.tab === "string" ? search.tab : undefined;
    return {
      tab:
        tab === "courses" || tab === "team" || tab === "profile" || tab === "overview"
          ? tab
          : undefined,
    };
  },
  head: () => ({
    meta: [{ title: "Business overview | MatchMax" }],
  }),
  component: BusinessOverview,
});

type ConsoleTab = "overview" | "courses" | "team" | "profile";

function BusinessOverview() {
  const navigate = useNavigate();
  const { tab: searchTab } = Route.useSearch();
  const tab: ConsoleTab = (searchTab as ConsoleTab) ?? "overview";
  const { user } = useAuth();
  const { membership, organization, usage, isLoading } = useMyOrganization();
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("mm-onboarding-dismissed") === "1",
  );

  const { data: recentCourses } = useQuery({
    queryKey: ["my-organization-recent-courses", organization?.id],
    queryFn: () => fetchCoursesByOrganizationId(organization!.id, 3),
    enabled: !!organization,
  });

  const analyticsFn = useServerFn(getBusinessAnalytics);
  const { data: analytics } = useQuery({
    queryKey: ["business-analytics", organization?.id],
    queryFn: () =>
      analyticsFn({ data: { organizationId: organization!.id } }) as Promise<BusinessAnalytics>,
    enabled: !!organization,
  });

  const showOnboarding = !!organization && !onboardingDismissed;

  const onboardingSteps = organization
    ? [
        { label: "Create your account", done: true, tab: "overview" as ConsoleTab },
        {
          label: "Complete your business profile",
          done: !!(organization.tagline && organization.description && organization.district),
          tab: "profile" as ConsoleTab,
        },
        {
          label: "Upload your logo & cover",
          done: !!(organization.logo_url && organization.cover_image_url),
          tab: "profile" as ConsoleTab,
        },
        {
          label: "Post your first course",
          done: (usage?.coursesUsed ?? 0) > 0,
          tab: "courses" as ConsoleTab,
        },
        {
          label: "Invite your team",
          done: (usage?.memberCount ?? 1) > 1,
          tab: "team" as ConsoleTab,
        },
      ]
    : [];
  const completedSteps = onboardingSteps.filter((step) => step.done).length;
  const onboardingPercent = Math.round((completedSteps / onboardingSteps.length) * 100);

  const dismissOnboarding = () => {
    setOnboardingDismissed(true);
    localStorage.setItem("mm-onboarding-dismissed", "1");
  };

  const switchTab = (next: string) => {
    navigate({ to: "/business", search: { tab: next } });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-muted/40">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading your business account…</p>
        </main>
      </div>
    );
  }

  if (!CENTRE_MARKET_ENABLED && !membership) {
    return <NotFoundComponent />;
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <EmptyState
            title="Sign in to continue"
            description="You need a MatchMax account to access the business console."
            action={
              <Button asChild>
                <a href="/auth">Sign in</a>
              </Button>
            }
          />
        </main>
      </div>
    );
  }

  if (!membership || !organization) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <div className="w-full max-w-lg">
            <EmptyState
              icon={BookOpen}
              title="No business account yet"
              description="Create a business account to post courses on MatchMax — up to 10 courses on the Business plan, unlimited on Enterprise."
              action={
                <Button
                  onClick={() => navigate({ to: "/business/join" })}
                  variant="solid"
                  color="blue"
                  className="font-bold"
                >
                  Create a business account
                </Button>
              }
              secondaryAction={
                <Button variant="outline" asChild>
                  <a href="/pricing">Compare plans</a>
                </Button>
              }
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <SiteHeader />
      <BusinessLayout
        organization={organization}
        usage={usage}
        activeTab={tab}
        onTabChange={switchTab}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[color:var(--ink)]">Overview</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {organization.tagline ?? "Your business account on MatchMax"}
            </p>
          </div>
          <PlanBadgeInline plan={organization.plan} status={organization.status} />
        </div>

        {organization.status === "pending" && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
              Your account is pending activation
            </p>
            <p className="mt-1 text-sm text-amber-700/80 dark:text-amber-400/80">
              Our team is reviewing your organization. Once activated, your courses will appear in
              the public directory automatically. You can already set up courses and your team.
            </p>
          </div>
        )}

        <Tabs value={tab} onValueChange={switchTab} className="mt-8 gap-6">
          <TabsContent value="overview">
            {/* Engagement stats (last 30 days) */}
            <div className="grid grid-cols-2 divide-x divide-y divide-border rounded-lg border border-border bg-card shadow-sm sm:grid-cols-4 sm:divide-y-0">
              <EngagementStat
                icon={Eye}
                label="Impressions"
                value={analytics?.totals.impression.current ?? 0}
                previous={analytics?.totals.impression.previous ?? 0}
                loading={!analytics}
              />
              <EngagementStat
                icon={BookOpen}
                label="Profile views"
                value={analytics?.totals.profile_view.current ?? 0}
                previous={analytics?.totals.profile_view.previous ?? 0}
                loading={!analytics}
              />
              <EngagementStat
                icon={Tag}
                label="Course views"
                value={analytics?.totals.course_view.current ?? 0}
                previous={analytics?.totals.course_view.previous ?? 0}
                loading={!analytics}
              />
              <EngagementStat
                icon={MousePointerClick}
                label="Contact clicks"
                value={analytics?.totals.contact_click.current ?? 0}
                previous={analytics?.totals.contact_click.previous ?? 0}
                loading={!analytics}
              />
            </div>

            {/* Traffic charts */}
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <div>
                  <h2 className="text-base font-bold text-[color:var(--ink)]">Reach</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Directory impressions and public profile views over the last 30 days
                  </p>
                </div>
                <div className="mt-4 h-60">
                  {analytics ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={analytics.daily}
                        margin={{ top: 4, right: 8, bottom: 0, left: -18 }}
                      >
                        <defs>
                          <linearGradient id="mmImpressions" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#1d9bf0" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="#1d9bf0" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="mmProfileViews" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0f1419" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="#0f1419" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(value: string) =>
                            format(new Date(`${value}T00:00:00`), "MMM d")
                          }
                          tickLine={false}
                          axisLine={false}
                          minTickGap={28}
                          tick={{ fontSize: 11, fill: "#64748b" }}
                        />
                        <YAxis
                          allowDecimals={false}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: "#64748b" }}
                        />
                        <Tooltip
                          labelFormatter={(value) =>
                            format(new Date(`${String(value)}T00:00:00`), "EEE, MMM d")
                          }
                          contentStyle={{
                            borderRadius: 10,
                            border: "1px solid #e2e8f0",
                            fontSize: 12,
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Area
                          type="monotone"
                          dataKey="impression"
                          name="Impressions"
                          stroke="#1d9bf0"
                          strokeWidth={2}
                          fill="url(#mmImpressions)"
                        />
                        <Area
                          type="monotone"
                          dataKey="profile_view"
                          name="Profile views"
                          stroke="#0f1419"
                          strokeWidth={2}
                          fill="url(#mmProfileViews)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Loading analytics…
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <div>
                  <h2 className="text-base font-bold text-[color:var(--ink)]">Engagement</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Course views and contact clicks over the last 30 days
                  </p>
                </div>
                <div className="mt-4 h-60">
                  {analytics ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={analytics.daily}
                        margin={{ top: 4, right: 8, bottom: 0, left: -18 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(value: string) =>
                            format(new Date(`${value}T00:00:00`), "MMM d")
                          }
                          tickLine={false}
                          axisLine={false}
                          minTickGap={28}
                          tick={{ fontSize: 11, fill: "#64748b" }}
                        />
                        <YAxis
                          allowDecimals={false}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: "#64748b" }}
                        />
                        <Tooltip
                          labelFormatter={(value) =>
                            format(new Date(`${String(value)}T00:00:00`), "EEE, MMM d")
                          }
                          contentStyle={{
                            borderRadius: 10,
                            border: "1px solid #e2e8f0",
                            fontSize: 12,
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar
                          dataKey="course_view"
                          name="Course views"
                          fill="#1d9bf0"
                          radius={[3, 3, 0, 0]}
                        />
                        <Bar
                          dataKey="contact_click"
                          name="Contact clicks"
                          fill="#0f1419"
                          radius={[3, 3, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Loading analytics…
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className={cn("mt-4 grid gap-4", showOnboarding && "lg:grid-cols-[1.5fr_1fr]")}>
              {showOnboarding && (
                <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                  <div className="flex items-start justify-between gap-3 border-b border-border p-6 pb-4">
                    <div className="flex flex-col gap-2">
                      <h2 className="text-base font-bold text-[color:var(--ink)]">
                        Getting started
                      </h2>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {completedSteps} of {onboardingSteps.length} complete
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={dismissOnboarding}
                      aria-label="Dismiss getting started checklist"
                      className="text-muted-foreground transition-colors hover:text-[color:var(--ink)]"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>

                  <div className="px-6 pt-4">
                    <Progress
                      value={onboardingPercent}
                      className="h-1.5 bg-muted [&>div]:bg-[#1d9bf0]"
                    />
                  </div>

                  <ul className="flex flex-col p-2">
                    {onboardingSteps.map((step) => (
                      <li key={step.label}>
                        <button
                          type="button"
                          onClick={() => switchTab(step.tab)}
                          className="flex w-full items-center gap-3 rounded-md px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/60"
                        >
                          <span
                            className={cn(
                              "flex size-5 shrink-0 items-center justify-center rounded-full border",
                              step.done
                                ? "border-[color:var(--btn-accent)] bg-[color:var(--btn-accent)] text-[color:var(--btn-accent-fg)]"
                                : "border-border",
                            )}
                          >
                            {step.done && <Check className="h-3 w-3" aria-hidden />}
                          </span>
                          <span
                            className={cn(
                              "flex-1",
                              step.done
                                ? "text-muted-foreground line-through"
                                : "font-medium text-[color:var(--ink)]",
                            )}
                          >
                            {step.label}
                          </span>
                          {!step.done && (
                            <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <h2 className="text-base font-bold text-[color:var(--ink)]">Plan & usage</h2>
                {usage ? (
                  <div className="mt-4 space-y-4">
                    <UsageMeter
                      used={usage.coursesUsed}
                      limit={usage.courseLimit}
                      label="Courses"
                    />
                    <UsageMeter
                      used={usage.memberCount}
                      limit={usage.memberLimit}
                      label="Team members"
                    />
                  </div>
                ) : null}
                <p className="mt-4 text-xs text-muted-foreground">
                  Need more courses or admin seats? Contact us to upgrade to Enterprise.
                </p>
              </section>
            </div>

            <section className="mt-8">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-bold text-[color:var(--ink)]">Recent posts</h2>
                <Button variant="outline" size="sm" onClick={() => switchTab("courses")}>
                  Manage courses
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {(recentCourses ?? []).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No published courses yet — post your first course to appear in the directory.
                  </div>
                ) : (
                  (recentCourses ?? []).map((course) => {
                    const price = formatCoursePrice(course.price, course.currency);
                    return (
                      <a
                        key={course.id}
                        href={`/courses/${course.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
                      >
                        {course.image_url ? (
                          <img
                            src={course.image_url}
                            alt=""
                            className="h-14 w-20 shrink-0 rounded-md border border-border object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
                            <BookOpen className="h-5 w-5" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[color:var(--ink)]">
                            {course.title}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {course.level ?? "General"} · {courseModeLabel(course.mode)}
                            {price ? ` · ${price}` : ""}
                            {` · Posted ${format(new Date(course.created_at), "d MMM yyyy")}`}
                          </p>
                        </div>
                        <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </a>
                    );
                  })
                )}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="courses">
            <CoursesPanel />
          </TabsContent>

          <TabsContent value="team">
            <TeamPanel />
          </TabsContent>

          <TabsContent value="profile">
            <ProfilePanel />
          </TabsContent>
        </Tabs>
      </BusinessLayout>
    </div>
  );
}

function EngagementStat({
  icon: Icon,
  label,
  value,
  previous,
  loading,
}: {
  icon: typeof Eye;
  label: string;
  value: number;
  previous: number;
  loading: boolean;
}) {
  const delta =
    previous > 0 ? Math.round(((value - previous) / previous) * 100) : value > 0 ? null : 0;
  return (
    <div className="flex flex-col gap-0.5 px-4 py-4">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {label}
      </span>
      <span className="text-xl font-black tabular-nums text-[color:var(--ink)]">
        {loading ? "…" : value.toLocaleString("en-HK")}
      </span>
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        last 30 days
        {delta !== null && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-semibold",
              delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-500" : "text-muted-foreground",
            )}
          >
            {delta > 0 ? <TrendingUp className="h-3 w-3" /> : null}
            {delta < 0 ? <TrendingDown className="h-3 w-3" /> : null}
            {delta > 0 ? `+${delta}%` : delta === 0 ? "0%" : `${delta}%`}
          </span>
        )}
        {delta === null && <span className="font-medium text-emerald-600">new</span>}
      </span>
    </div>
  );
}

function PlanBadgeInline({ plan, status }: { plan: string; status: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
          plan === "enterprise"
            ? "bg-violet-50 text-violet-700 ring-violet-700/10"
            : "bg-blue-50 text-blue-700 ring-blue-700/10"
        }`}
      >
        {plan === "enterprise" ? "Enterprise" : "Business"}
      </span>
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
          status === "active"
            ? "bg-emerald-50 text-emerald-700 ring-emerald-700/10"
            : status === "pending"
              ? "bg-amber-50 text-amber-700 ring-amber-700/10"
              : "bg-red-50 text-red-700 ring-red-700/10"
        }`}
      >
        {status === "active" ? "Active" : status === "pending" ? "Pending" : "Suspended"}
      </span>
    </div>
  );
}
