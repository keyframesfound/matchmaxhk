import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { CircleHelp, Loader2, X } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { confirmState, type CalendarSummary } from "@/features/cases/calendar-hub";
import { getMyCalendar } from "@/features/cases/calendar-hub.functions";
import { CaseDrawer } from "@/features/cases/case-manager/case-drawer";
import { BillingSamplePreview } from "@/features/cases/case-manager/billing-tab";
import { HomeworkSamplePreview } from "@/features/cases/case-manager/homework-tab";
import { ProgressSamplePreview } from "@/features/cases/case-manager/progress-tab";
import { BlockedTimes } from "@/features/cases/case-manager/blocked-times";
import { ActiveCaseList, ProposedList } from "@/features/cases/case-manager/hub-sections";
import { ThinCalendar } from "@/features/cases/case-manager/thin-calendar";
import { caseCodeFromParam, caseTabFromParam, type CaseTab } from "@/features/cases/case-schedule";
import {
  confirmMyAvailabilityFresh,
  getCaseManagerSchedule,
} from "@/features/cases/case-schedule.functions";
import { availabilityFreshness } from "@/features/cases/availability-freshness";
import { ProfileStrengthSection } from "@/features/account/profile-strength-card";
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
  validateSearch: (search: Record<string, unknown>): { case?: string; tab?: CaseTab } => {
    const code = caseCodeFromParam(search.case);
    if (!code) return {};
    const tab = caseTabFromParam(search.tab);
    return tab === "overview" ? { case: code } : { case: code, tab };
  },
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

/**
 * #673: 14-day availability freshness. Stale grids lose 15 Profile-Strength
 * points until the tutor taps "Confirm schedule is up to date" — one tap,
 * no grid edit. Never-confirmed tutors see a soft nudge instead.
 */
function FreshnessBanner({ confirmedAt }: { confirmedAt: string | null }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const confirm = useMutation({
    mutationFn: () => confirmMyAvailabilityFresh(),
    onSuccess: () => {
      toast.success(t("calendar_hub.freshness_done"));
      void queryClient.invalidateQueries({ queryKey: ["case-manager-schedule"] });
    },
    onError: () => toast.error(t("calendar_hub.error")),
  });
  const fresh = availabilityFreshness(confirmedAt);
  if (!fresh.stale && !fresh.neverConfirmed) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-panel)] border border-border bg-card p-4 text-sm">
      <p className="text-muted-foreground">
        {fresh.stale
          ? t("calendar_hub.freshness_stale", { days: fresh.daysSinceConfirmed ?? 0 })
          : t("calendar_hub.freshness_never")}
      </p>
      <Button type="button" size="sm" disabled={confirm.isPending} onClick={() => confirm.mutate()}>
        {confirm.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
        {t("calendar_hub.freshness_cta")}
      </Button>
    </div>
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
  const queryClient = useQueryClient();
  const navigate = Route.useNavigate();
  const { case: caseParam, tab: tabParam } = Route.useSearch();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["calendar-hub"],
    queryFn: () => getMyCalendar(),
  });
  const schedule = useQuery({
    queryKey: ["case-manager-schedule"],
    queryFn: () => getCaseManagerSchedule(),
  });
  const openCase = caseParam ? schedule.data?.cases.find((c) => c.code === caseParam) : undefined;
  const setCaseParam = (code?: string) =>
    void navigate({ search: code ? { case: code } : {}, replace: !code });
  const refreshSchedule = () => {
    void queryClient.invalidateQueries({ queryKey: ["case-manager-schedule"] });
    void queryClient.invalidateQueries({ queryKey: ["calendar-hub"] });
    void queryClient.invalidateQueries({ queryKey: ["sor", "tutor-cases"] });
  };
  // #594: an unknown or unauthorized ?case= keeps the hub up and drops the param.
  useEffect(() => {
    if (caseParam && schedule.data && !openCase) {
      toast.error(t("case_manager.case_not_found"));
      void navigate({ search: {}, replace: true });
    }
  }, [caseParam, schedule.data, openCase, navigate, t]);
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
        {schedule.data?.isTutor ? (
          <FreshnessBanner confirmedAt={schedule.data.availabilityConfirmedAt} />
        ) : null}
        <ThinCalendar
          lessons={schedule.data?.lessons ?? []}
          blockedDates={schedule.data?.blockedDates ?? []}
          onOpenCase={setCaseParam}
        />
        <ActiveCaseList
          cases={schedule.data?.cases ?? []}
          lessons={schedule.data?.lessons ?? []}
          onOpenCase={setCaseParam}
        />
        <ProposedList items={schedule.data?.proposed ?? []} />
        {/* #659: tutors keep their own windows and blackouts; parents block here. */}
        {schedule.data &&
        (!schedule.data.isTutor ||
          schedule.data.blockedSlots.length > 0 ||
          schedule.data.cases.some((c) => c.role === "parent") ||
          schedule.data.proposed.some((p) => p.role === "parent")) ? (
          <BlockedTimes slots={schedule.data.blockedSlots} />
        ) : null}
        {isLoading && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
        {(isError || schedule.isError) && (
          <p className="text-sm text-destructive">{t("calendar_hub.error")}</p>
        )}
        {data?.tutor && (
          <>
            <SummarySection summary={data.tutor} role="tutor" />
            <EarningsPanel />
          </>
        )}
        {data?.parent && <SummarySection summary={data.parent} role="parent" />}
        {data && !hasCases ? <EmptyCases /> : null}
        {data && !hasCases && schedule.data?.isTutor ? <ProfileStrengthSection /> : null}
        {data && !hasCases ? <HomeworkSamplePreview /> : null}
        {data && !hasCases ? <ProgressSamplePreview /> : null}
        {data && !hasCases ? <BillingSamplePreview /> : null}
        {isError ? <EmptyCases /> : null}
        <HowToUse open={howToOpen} onOpenChange={setHowToOpen} />
        {openCase && schedule.data ? (
          <CaseDrawer
            key={openCase.id}
            scheduleCase={openCase}
            lessons={schedule.data.lessons}
            tab={caseTabFromParam(tabParam)}
            onTabChange={(tab) =>
              void navigate({
                search: tab === "overview" ? { case: openCase.code } : { case: openCase.code, tab },
                replace: true,
              })
            }
            onClose={() => setCaseParam()}
            onChanged={refreshSchedule}
          />
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
