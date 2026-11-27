import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { assessmentPct, hoursBars, summarizeProgress } from "@/features/cases/case-progress";
import { getCaseProgressForStaff } from "@/features/cases/case-progress.functions";
import type { TutorPerformance } from "@/features/cases/tutor-performance";
import { getTutorPerformance } from "@/features/cases/tutor-performance.functions";

import { ProgressChart } from "./progress-chart";

/** #736 AC6: English-first desk copy, inline like the rest of the Admin desk. */
const TUTOR_PERF_COPY = {
  title: "Tutor performance (12 weeks)",
  empty: "No tutor activity in the last 12 weeks.",
  error: "Couldn’t load tutor performance.",
  homework: "Homework reviewed",
  noHomework: "No homework",
  rating: "Average rating",
  noReviews: "No reviews yet",
} as const;

const PERF_VIEW_WIDTH = 320;
const PERF_VIEW_HEIGHT = 64;
const PERF_PAD_X = 2;
const PERF_BAR_GAP = 3;
const PERF_MIN_BAR = 2;

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

/**
 * #736 AC6: verified hours by HKT week. Hand-rolled SVG on the same
 * border-led, shadowless footing as progress-chart.tsx; the accessible name
 * carries the 12-week total, so the bars need no per-bar labels.
 */
function TutorHoursChart({ perf }: { perf: TutorPerformance }) {
  const max = Math.max(...perf.weeks.map((week) => week.hours), 0);
  const plotHeight = PERF_VIEW_HEIGHT - PERF_MIN_BAR;
  const slot = (PERF_VIEW_WIDTH - PERF_PAD_X * 2) / perf.weeks.length;
  const barWidth = Math.max(slot - PERF_BAR_GAP, PERF_MIN_BAR);
  const baselineY = PERF_VIEW_HEIGHT;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${PERF_VIEW_WIDTH} ${PERF_VIEW_HEIGHT}`}
        role="img"
        aria-label={`Verified hours by week over the last 12 weeks, ${perf.totalHours.toFixed(1)} hours total.`}
        className="block h-auto w-full"
      >
        {perf.weeks.map((week, index) => {
          const height = max > 0 ? (week.hours / max) * plotHeight : 0;
          const drawn = week.hours > 0 ? Math.max(height, PERF_MIN_BAR) : 0;
          return (
            <rect
              key={week.weekStart}
              x={PERF_PAD_X + index * slot + PERF_BAR_GAP / 2}
              y={baselineY - drawn}
              width={barWidth}
              height={drawn}
              rx={2}
              fill="color-mix(in oklab, var(--ink) 14%, transparent)"
            />
          );
        })}
        <line
          x1={PERF_PAD_X}
          x2={PERF_VIEW_WIDTH - PERF_PAD_X}
          y1={baselineY}
          y2={baselineY}
          stroke="var(--border)"
          strokeWidth={1}
        />
      </svg>
    </figure>
  );
}

function TutorPerformanceBody({ perf }: { perf: TutorPerformance }) {
  const { homework, rating } = perf;
  const hasHours = perf.weeks.some((week) => week.hours > 0);
  const empty = !hasHours && homework.assigned === 0 && rating.count === 0;
  if (empty) {
    return <p className="text-sm text-muted-foreground">{TUTOR_PERF_COPY.empty}</p>;
  }

  const homeworkText =
    homework.assigned === 0 || homework.rate === null
      ? TUTOR_PERF_COPY.noHomework
      : `${homework.reviewed} of ${homework.assigned} · ${homework.rate}%`;
  const ratingText =
    rating.average === null
      ? TUTOR_PERF_COPY.noReviews
      : `${rating.average.toFixed(1)} from ${rating.count} review${rating.count === 1 ? "" : "s"}`;

  return (
    <>
      {hasHours ? <TutorHoursChart perf={perf} /> : null}
      <dl className="divide-y divide-border rounded-xl border border-border">
        <div className="flex items-baseline justify-between gap-3 px-3 py-2">
          <dt className="text-xs text-muted-foreground">{TUTOR_PERF_COPY.homework}</dt>
          <dd className="text-sm font-semibold">{homeworkText}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 px-3 py-2">
          <dt className="text-xs text-muted-foreground">{TUTOR_PERF_COPY.rating}</dt>
          <dd className="text-sm font-semibold">{ratingText}</dd>
        </div>
      </dl>
    </>
  );
}

/**
 * #736 AC6: the assigned tutor's 12-week operating record, read from the case
 * so an admin inspecting it sees hours, homework review and rating together.
 * Tutor-scoped, so it never exposes another case's family.
 */
function TutorPerformanceSection({ caseId }: { caseId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["tutor-performance", caseId],
    queryFn: () => getTutorPerformance({ data: { caseId } }),
  });

  return (
    <section className="space-y-2 rounded-[var(--radius-panel)] border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">{TUTOR_PERF_COPY.title}</h3>
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      ) : isError || !data ? (
        <p className="text-sm text-destructive">{TUTOR_PERF_COPY.error}</p>
      ) : (
        <TutorPerformanceBody perf={data} />
      )}
    </section>
  );
}

/**
 * #736: the Admin Case Management read of a case's Progress graph. Ops is not
 * a party of the case, so this is read-only: no logging, no target edits, and
 * no names beyond the score rows the graph already shows.
 */
export function StaffProgressPanel({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["case-progress-staff", caseId],
    queryFn: () => getCaseProgressForStaff({ data: { caseId } }),
  });

  if (isLoading) return <Loader2 className="mt-2 h-5 w-5 animate-spin" aria-hidden />;
  if (isError || !data) {
    return <p className="mt-2 text-sm text-destructive">{t("progress.err_generic")}</p>;
  }

  const summary = summarizeProgress(data.scores, data.targetPct);
  const percent = (value: number | null) => (value === null ? "--" : `${value}%`);
  const progressValue =
    summary.delta === null
      ? summary.baseline === null
        ? "--"
        : t("progress.one_more")
      : `${summary.delta > 0 ? "+" : ""}${summary.delta}%${summary.onTarget ? ` · ${t("progress.on_target")}` : ""}`;
  const averagePct =
    data.scores.length === 0
      ? null
      : Math.round(
          (data.scores.reduce((sum, s) => sum + assessmentPct(s.marks, s.maxMarks), 0) /
            data.scores.length) *
            10,
        ) / 10;
  const targetLabel =
    data.targetPct === null
      ? null
      : data.targetGrade
        ? t("progress.target_line", { pct: data.targetPct, grade: data.targetGrade })
        : t("progress.target_line_no_grade", { pct: data.targetPct });

  return (
    <>
      <section className="space-y-2 rounded-[var(--radius-panel)] border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">{t("progress.chart_title")}</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label={t("progress.stat_baseline")} value={percent(summary.baseline)} />
          <StatCard label={t("progress.stat_latest")} value={percent(summary.latest)} />
          <StatCard label={t("progress.stat_progress")} value={progressValue} />
          <StatCard label={t("progress.stat_average")} value={percent(averagePct)} />
          <StatCard label={t("progress.stat_hours")} value={`${data.verifiedHours.toFixed(1)}h`} />
        </div>
        {data.scores.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("progress.empty_hint")}</p>
        ) : (
          <ProgressChart
            scores={data.scores}
            targetPct={data.targetPct}
            targetLabel={targetLabel}
            hours={hoursBars(data.scores, data.hoursSeries)}
            hoursMax={data.verifiedHours}
          />
        )}
      </section>
      <TutorPerformanceSection caseId={caseId} />
    </>
  );
}
