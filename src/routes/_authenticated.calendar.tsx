import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { addDays, endOfMonth, format, isSameDay, startOfMonth, startOfWeek } from "date-fns";
import { useEffect, useState } from "react";
import { CircleHelp, Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { confirmState, type CalendarSummary } from "@/features/cases/calendar-hub";
import { getMyCalendar } from "@/features/cases/calendar-hub.functions";
import { EarningsPanel } from "@/features/cases/tutor/earnings-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * #461 amendment: the top-bar Calendar hub. Signed-out visitors go through
 * the _authenticated gate (/auth with Google, then back here). Tutors see
 * the students they teach plus the Schedule & Earnings buckets; parents see
 * their tutors and lesson record (no admin fee: tutor-pays).
 */
export const Route = createFileRoute("/_authenticated/calendar")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Case Manager | MatchMax" }, { name: "robots", content: "noindex" }],
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

const COACH_KEY = "mm_case_manager_coach_v1";

/** #594: thin month grid, a visual shell (not a full calendar product). */
function ThinMonth({ lessonDates }: { lessonDates: Date[] }) {
  const { t } = useTranslation();
  const today = new Date();
  const first = startOfWeek(startOfMonth(today), { weekStartsOn: 1 });
  const last = endOfMonth(today);
  const days: Date[] = [];
  for (let d = first; d <= last || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d);
  return (
    <section
      aria-label={t("case_manager.calendar_aria")}
      className="rounded-[var(--radius-panel)] border border-border bg-card p-4"
    >
      <p className="mb-3 text-sm font-semibold">{format(today, "MMMM yyyy")}</p>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
        {days.map((d) => {
          const inMonth = d.getMonth() === today.getMonth();
          const hasLesson = lessonDates.some((l) => isSameDay(l, d));
          const isToday = isSameDay(d, today);
          return (
            <span
              key={d.toISOString()}
              className={
                "relative flex h-8 items-center justify-center rounded-lg text-xs " +
                (isToday
                  ? "bg-[color:var(--ink)] font-bold text-[color:var(--surface-invert-fg)]"
                  : inMonth
                    ? "text-[color:var(--ink)]"
                    : "text-muted-foreground/40")
              }
            >
              {d.getDate()}
              {hasLesson ? (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[color:var(--brand-link)]" />
              ) : null}
            </span>
          );
        })}
      </div>
    </section>
  );
}

/** #594: empty Case Manager still shows the shape of the hub. */
function EmptyCases() {
  const { t } = useTranslation();
  return (
    <section className="space-y-3 rounded-[var(--radius-panel)] border border-border bg-card p-5">
      <h2 className="text-lg font-bold">{t("case_manager.active_cases")}</h2>
      <div aria-hidden className="space-y-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-dashed border-border p-3 opacity-60"
          >
            <span className="h-9 w-9 rounded-full bg-[color:var(--surface-subtle)]" />
            <span className="flex-1 space-y-1.5">
              <span className="block h-3 w-2/5 rounded bg-[color:var(--surface-subtle)]" />
              <span className="block h-3 w-3/5 rounded bg-[color:var(--surface-subtle)]" />
            </span>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{t("case_manager.empty_body")}</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="solid" color="neutral" size="sm">
          <Link to="/tutors">{t("case_manager.cta_find")}</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/case-request">{t("case_manager.cta_post")}</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/tutor-requests">{t("case_manager.cta_browse")}</Link>
        </Button>
      </div>
    </section>
  );
}

function HowToUse({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>{t("case_manager.howto_title")}</DialogTitle>
        <DialogDescription className="sr-only">{t("case_manager.howto_title")}</DialogDescription>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
          <li>{t("case_manager.howto_1")}</li>
          <li>{t("case_manager.howto_2")}</li>
          <li>{t("case_manager.howto_3")}</li>
          <li>{t("case_manager.howto_4")}</li>
        </ol>
      </DialogContent>
    </Dialog>
  );
}

function CalendarPage() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["calendar-hub"],
    queryFn: () => getMyCalendar(),
  });
  const [howToOpen, setHowToOpen] = useState(false);
  // #594: first-visit coach tip (dismissible, remembered on this device).
  const [showCoach, setShowCoach] = useState(false);
  useEffect(() => {
    try {
      setShowCoach(localStorage.getItem(COACH_KEY) !== "1");
    } catch {
      setShowCoach(false);
    }
  }, []);
  const dismissCoach = () => {
    setShowCoach(false);
    try {
      localStorage.setItem(COACH_KEY, "1");
    } catch {
      // private mode: the tip just shows again next time
    }
  };
  const lessonDates = [...(data?.tutor?.upcoming ?? []), ...(data?.parent?.upcoming ?? [])].map(
    (l) => new Date(l.startsAt),
  );
  const hasCases = Boolean(data?.tutor || data?.parent);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{t("case_manager.title")}</h1>
          <Button type="button" variant="outline" size="sm" onClick={() => setHowToOpen(true)}>
            <CircleHelp className="mr-1.5 h-4 w-4" aria-hidden />
            {t("case_manager.howto_button")}
          </Button>
        </div>
        {showCoach ? (
          <div className="relative rounded-[var(--radius-panel)] border border-[color:var(--brand-link)]/40 bg-[color:var(--brand-link)]/5 p-4 pr-10 text-sm">
            <p className="font-semibold">{t("case_manager.coach_title")}</p>
            <p className="mt-1 text-muted-foreground">{t("case_manager.coach_body")}</p>
            <button
              type="button"
              onClick={dismissCoach}
              aria-label={t("case_manager.coach_dismiss")}
              className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:text-[color:var(--ink)]"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : null}
        <ThinMonth lessonDates={lessonDates} />
        {isLoading && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
        {isError && <p className="text-sm text-destructive">{t("calendar_hub.error")}</p>}
        {data?.tutor && (
          <>
            <SummarySection summary={data.tutor} role="tutor" />
            <EarningsPanel />
          </>
        )}
        {data?.parent && <SummarySection summary={data.parent} role="parent" />}
        {data && !hasCases ? <EmptyCases /> : null}
        {isError ? <EmptyCases /> : null}
        <HowToUse open={howToOpen} onOpenChange={setHowToOpen} />
      </main>
      <SiteFooter />
    </div>
  );
}
