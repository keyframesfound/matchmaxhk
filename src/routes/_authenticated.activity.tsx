import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { getMyCalendar } from "@/features/cases/calendar-hub.functions";
import { getMyBell, type BellItem } from "@/features/cases/bus.functions";
import { bellLabelKey } from "@/components/layout/bell-menu";
import { ProfileStrengthSection } from "@/features/account/profile-strength-card";
import { HouseholdSummary } from "@/features/cases/demand-side/household-summary";
import { useAuth } from "@/features/auth/useAuth";

/**
 * Issue #670 — My MatchMax / Activity dashboard. One coherent page for the
 * loops that live on separate surfaces: pending requests, upcoming lessons,
 * Profile Strength, schedule-fit surfaces and the household summary. It
 * reuses the SAME data sources (bell, calendar hub, profile strength) — no
 * second schedule DB, no second ratings store — and is mode-aware.
 */
export const Route = createFileRoute("/_authenticated/activity")({
  ssr: false,
  head: () => ({
    meta: [{ title: "My MatchMax | MatchMax" }, { name: "robots", content: "noindex" }],
  }),
  component: ActivityPage,
});

function Module({
  title,
  href,
  cta,
  children,
}: {
  title: string;
  href?: string;
  cta?: string;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section className="space-y-2 rounded-[var(--radius-panel)] border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold">{title}</h2>
        {href && cta ? (
          <Link
            to={href}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-link)] hover:underline"
          >
            {cta}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function PendingModule({ items, open }: { items: BellItem[]; open: number }) {
  const { t } = useTranslation();
  return (
    <Module
      title={t("activity.pending_title")}
      href="/notifications"
      cta={t("activity.pending_all", { n: open })}
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("activity.pending_empty")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="py-2.5 text-sm">
              {item.link ? (
                <a href={item.link} className="font-medium text-[color:var(--ink)] hover:underline">
                  {t(bellLabelKey(item))}
                </a>
              ) : (
                <span className="font-medium text-[color:var(--ink)]">{t(bellLabelKey(item))}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Module>
  );
}

function UpcomingModule({
  upcoming,
}: {
  upcoming: {
    id: string;
    startsAt: string;
    durationMin: number;
    caseCode: string;
    counterpart: string;
  }[];
}) {
  const { t } = useTranslation();
  return (
    <Module
      title={t("activity.upcoming_title")}
      href="/calendar"
      cta={t("activity.open_case_manager")}
    >
      {upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("activity.upcoming_empty")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {upcoming.map((l) => (
            <li key={l.id} className="py-2.5 text-sm">
              <Link
                to="/calendar"
                search={{ case: l.caseCode }}
                className="font-medium text-[color:var(--ink)] hover:underline"
              >
                {format(new Date(l.startsAt), "EEE d MMM, HH:mm")} ·{" "}
                {t("calendar_hub.minutes", { n: l.durationMin })}
              </Link>
              <span className="ml-2 text-xs text-muted-foreground">
                {l.counterpart} · {l.caseCode}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Module>
  );
}

function ScheduleFitModule({ isTutor }: { isTutor: boolean }) {
  const { t } = useTranslation();
  return (
    <Module
      title={t("activity.fit_title")}
      href={isTutor ? "/tutor-requests" : "/tutors"}
      cta={isTutor ? t("activity.fit_browse_cases") : t("activity.fit_browse_tutors")}
    >
      <p className="text-sm text-muted-foreground">
        {isTutor ? t("activity.fit_tutor_body") : t("activity.fit_parent_body")}
      </p>
    </Module>
  );
}

function ActivityPage() {
  const { t } = useTranslation();
  const { activeRole } = useAuth();
  const calendar = useQuery({ queryKey: ["calendar-hub"], queryFn: () => getMyCalendar() });
  const bell = useQuery({ queryKey: ["bell"], queryFn: () => getMyBell() });
  const isTutor = activeRole === "tutor";

  const upcoming = [
    ...(calendar.data?.tutor?.upcoming ?? []),
    ...(calendar.data?.parent?.upcoming ?? []),
  ]
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 5);
  const pending = (bell.data?.items ?? [])
    .filter((item) => item.action_required && item.action_status === "open")
    .slice(0, 4);
  const hasAnything =
    upcoming.length > 0 ||
    pending.length > 0 ||
    Boolean(calendar.data?.tutor || calendar.data?.parent);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
        <h1 className="text-2xl font-bold">{t("activity.title")}</h1>
        {!hasAnything && !calendar.isLoading ? (
          <section className="rounded-[var(--radius-panel)] border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{t("activity.empty_all")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to="/dashboard"
                hash="my-tutor"
                className="rounded-full border border-border px-4 py-1.5 text-sm font-semibold hover:border-[color:var(--brand-link)]"
              >
                {t("activity.empty_nba_profile")}
              </Link>
              <Link
                to="/case-request"
                className="rounded-full border border-border px-4 py-1.5 text-sm font-semibold hover:border-[color:var(--brand-link)]"
              >
                {t("activity.empty_nba_case")}
              </Link>
            </div>
          </section>
        ) : null}
        {pending.length > 0 || (bell.data?.openActions ?? 0) > 0 ? (
          <PendingModule items={pending} open={bell.data?.openActions ?? 0} />
        ) : (
          <PendingModule items={[]} open={0} />
        )}
        <UpcomingModule upcoming={upcoming} />
        <ScheduleFitModule isTutor={isTutor} />
        <ProfileStrengthSection />
        {!isTutor ? <HouseholdSummary /> : null}
      </main>
      <SiteFooter />
    </div>
  );
}
