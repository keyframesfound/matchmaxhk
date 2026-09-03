import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, BookOpen, Check, ExternalLink, X } from "lucide-react";

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
  courseModeLabel,
  fetchPublishedCourses,
  formatCoursePrice,
} from "@/features/courses/queries";
import { cn } from "@/lib/utils";

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

  const { data: publishedCourses } = useQuery({
    queryKey: ["my-organization-published", organization?.id],
    queryFn: () => fetchPublishedCourses({}, 100),
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
                  className="bg-[color:var(--surface-invert)] font-bold text-white hover:bg-[color:var(--surface-invert-hover)]"
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

        {/* Stats strip */}
        <div className="mt-6 grid grid-cols-2 divide-x divide-border rounded-lg border border-border bg-card shadow-sm sm:grid-cols-4">
          <StatCell value={usage?.coursesUsed ?? 0} label="Courses posted" />
          <StatCell
            value={usage?.memberCount ?? 1}
            label={usage?.memberLimit ? `of ${usage.memberLimit} seats` : "team members"}
          />
          <StatCell
            value={organization.founded_year ? String(organization.founded_year) : "—"}
            label="Founded"
          />
          <div className="flex flex-col justify-center gap-0.5 px-4 py-4">
            <a
              href={`/business/${organization.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-bold text-[color:var(--brand-link)] hover:underline"
            >
              /business/{organization.slug}
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
            <span className="text-xs text-muted-foreground">Public profile</span>
          </div>
        </div>

        <Tabs value={tab} onValueChange={switchTab} className="mt-8 gap-6">
          <TabsContent value="overview">
            <div className={cn("grid gap-4", showOnboarding && "lg:grid-cols-[1.5fr_1fr]")}>
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
                      className="h-1.5 bg-muted [&>div]:bg-[#1FA8B6]"
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
                                ? "border-[#1FA8B6] bg-[#1FA8B6] text-white"
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
              <h2 className="text-base font-bold text-[color:var(--ink)]">
                Your published courses
              </h2>
              <div className="mt-4 space-y-3">
                {(publishedCourses ?? []).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No published courses yet — post your first course to appear in the directory.
                  </div>
                ) : (
                  (publishedCourses ?? []).map((course) => {
                    const price = formatCoursePrice(course.price, course.currency);
                    return (
                      <a
                        key={course.id}
                        href={`/courses/${course.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[color:var(--ink)]">
                            {course.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {course.level ?? "General"} · {courseModeLabel(course.mode)}
                            {price ? ` · ${price}` : ""}
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

function StatCell({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 py-4 text-center">
      <span className="text-xl font-black tabular-nums text-[color:var(--ink)]">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
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
