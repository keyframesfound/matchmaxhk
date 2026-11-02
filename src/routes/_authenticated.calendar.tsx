import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { confirmState, type CalendarSummary } from "@/features/cases/calendar-hub";
import { getMyCalendar } from "@/features/cases/calendar-hub.functions";
import { EarningsPanel } from "@/features/cases/tutor/earnings-panel";

/**
 * #461 amendment: the top-bar Calendar hub. Signed-out visitors go through
 * the _authenticated gate (/auth with Google, then back here). Tutors see
 * the students they teach plus the Schedule & Earnings buckets; parents see
 * their tutors and lesson record (no admin fee: tutor-pays).
 */
export const Route = createFileRoute("/_authenticated/calendar")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Calendar | MatchMax" }, { name: "robots", content: "noindex" }],
  }),
  component: CalendarPage,
});

function SummarySection({ summary, role }: { summary: CalendarSummary; role: "tutor" | "parent" }) {
  const { t } = useTranslation();
  return (
    <section className="space-y-4 rounded-[var(--radius-panel)] border border-border bg-card p-5">
      <h2 className="text-lg font-bold">
        {t(role === "tutor" ? "calendar_hub.tutor_title" : "calendar_hub.parent_title")}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t("calendar_hub.counts", {
          upcoming: summary.upcoming.length,
          month: summary.thisMonthScheduled,
        })}
      </p>
      {summary.upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("calendar_hub.empty")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {summary.upcoming.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div>
                <p className="text-sm font-semibold">
                  {format(new Date(l.startsAt), "EEE d MMM, HH:mm")} ·{" "}
                  {t("calendar_hub.minutes", { n: l.durationMin })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t(role === "tutor" ? "calendar_hub.with_student" : "calendar_hub.with_tutor", {
                    name: l.counterpart,
                  })}{" "}
                  · {l.caseCode}
                </p>
              </div>
              <span className="rounded-full bg-[color:var(--foreground)]/[0.06] px-2.5 py-0.5 text-xs">
                {t(`calendar_hub.confirm_${confirmState(l)}`)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div>
        <p className="text-xs font-semibold text-muted-foreground">
          {t("calendar_hub.history_title")}
        </p>
        <ul className="mt-1 grid grid-cols-3 gap-2 text-sm">
          {summary.history.map((m) => (
            <li key={m.month} className="rounded-xl border border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">{m.month}</p>
              <p className="font-semibold">
                {t("calendar_hub.history_line", { lessons: m.lessons, hours: m.hours })}
              </p>
            </li>
          ))}
        </ul>
      </div>
      {role === "tutor" ? (
        <Link
          to="/dashboard"
          hash="lessons"
          className="inline-block text-sm font-semibold text-[color:var(--brand-link)] hover:underline"
        >
          {t("calendar_hub.open_tutor")}
        </Link>
      ) : (
        <Link
          to="/account/cases"
          className="inline-block text-sm font-semibold text-[color:var(--brand-link)] hover:underline"
        >
          {t("calendar_hub.open_parent")}
        </Link>
      )}
    </section>
  );
}

function CalendarPage() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["calendar-hub"],
    queryFn: () => getMyCalendar(),
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
        <h1 className="text-2xl font-bold">{t("calendar_hub.title")}</h1>
        {isLoading && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
        {isError && <p className="text-sm text-destructive">{t("calendar_hub.error")}</p>}
        {data?.tutor && (
          <>
            <SummarySection summary={data.tutor} role="tutor" />
            <EarningsPanel />
          </>
        )}
        {data?.parent && <SummarySection summary={data.parent} role="parent" />}
        {data && !data.tutor && !data.parent && (
          <p className="text-sm text-muted-foreground">{t("calendar_hub.no_cases")}</p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
