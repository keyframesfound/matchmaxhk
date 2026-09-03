import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ExternalLink, PlusCircle, UsersRound } from "lucide-react";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/business/empty-state";
import { BusinessLayout, UsageMeter } from "@/components/business/business-layout";
import { useAuth } from "@/features/auth/useAuth";
import { useMyOrganization } from "@/features/business/useMyOrganization";
import {
  courseModeLabel,
  fetchPublishedCourses,
  formatCoursePrice,
} from "@/features/courses/queries";

export const Route = createFileRoute("/_authenticated/business/")({
  head: () => ({
    meta: [{ title: "Business overview | MatchMax" }],
  }),
  component: BusinessOverview,
});

function BusinessOverview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { membership, organization, usage, isLoading } = useMyOrganization();

  const { data: publishedCourses } = useQuery({
    queryKey: ["my-organization-published", organization?.id],
    queryFn: () => fetchPublishedCourses({}, 100),
    enabled: !!organization,
  });

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
      <BusinessLayout organization={organization} usage={usage}>
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

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <BookOpen className="h-5 w-5 text-[#1FA8B6]" />
              <span className="text-xs font-medium text-muted-foreground">Courses</span>
            </div>
            <p className="mt-3 text-3xl font-black text-[color:var(--ink)]">
              {usage?.coursesUsed ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">
              {usage?.courseLimit == null
                ? "posted · unlimited"
                : `of ${usage.courseLimit} allowed`}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <UsersRound className="h-5 w-5 text-[#1FA8B6]" />
              <span className="text-xs font-medium text-muted-foreground">Team members</span>
            </div>
            <p className="mt-3 text-3xl font-black text-[color:var(--ink)]">
              {usage?.memberCount ?? 1}
            </p>
            <p className="text-xs text-muted-foreground">of {usage?.memberLimit ?? 2} allowed</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <ExternalLink className="h-5 w-5 text-[#1FA8B6]" />
              <span className="text-xs font-medium text-muted-foreground">Profile URL</span>
            </div>
            <p className="mt-3 break-all text-sm font-bold text-[color:var(--ink)]">
              /business/{organization.slug}
            </p>
            <a
              href={`/business/${organization.slug}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--brand-link)] hover:underline"
            >
              View public profile
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="text-base font-bold text-[color:var(--ink)]">Quick actions</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Button variant="outline" asChild className="justify-start">
                <a href="/business/courses">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Post a new course
                </a>
              </Button>
              <Button variant="outline" asChild className="justify-start">
                <a href="/business/team">
                  <UsersRound className="mr-2 h-4 w-4" />
                  Invite a team admin
                </a>
              </Button>
              <Button variant="outline" asChild className="justify-start">
                <a href="/business/settings">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Edit business profile
                </a>
              </Button>
              <Button variant="outline" asChild className="justify-start">
                <a href="/courses" target="_blank" rel="noreferrer">
                  <BookOpen className="mr-2 h-4 w-4" />
                  View public directory
                </a>
              </Button>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="text-base font-bold text-[color:var(--ink)]">Plan & usage</h2>
            {usage ? (
              <div className="mt-4 space-y-4">
                <UsageMeter used={usage.coursesUsed} limit={usage.courseLimit} label="Courses" />
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
          <h2 className="text-base font-bold text-[color:var(--ink)]">Your published courses</h2>
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
      </BusinessLayout>
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
