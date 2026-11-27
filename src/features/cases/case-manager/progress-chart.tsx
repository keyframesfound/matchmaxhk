import { useState } from "react";
import { useTranslation } from "react-i18next";

import { chartPoints, type AssessmentScore } from "@/features/cases/case-progress";

const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 170;
const PAD_LEFT = 34;
const PAD_RIGHT = 12;
const PAD_Y = 12;
const PLOT_WIDTH = VIEW_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = VIEW_HEIGHT - PAD_Y * 2;
const GRID_PERCENTS = [0, 50, 100];
const MARKER_R = 4;
const HIT_R = 16;
/** #736: verified hours read as background bars behind the score line. */
const BAR_WIDTH = 12;

export type ChartScore = AssessmentScore & {
  id: string;
  name: string;
  gradeLabel: string | null;
  note: string | null;
};

function yFor(pct: number): number {
  return PAD_Y + PLOT_HEIGHT - (pct / 100) * PLOT_HEIGHT;
}

/**
 * #653 grade curve with #736 verified hours behind it: the line stays on top,
 * the bars are context. Plain SVG, no chart library. The assessment log below
 * is its table view. Details sit under the plot, so they never cover a point
 * on a small screen.
 */
export function ProgressChart({
  scores,
  targetPct,
  targetLabel,
  hours,
  hoursMax,
  sample = false,
}: {
  scores: readonly ChartScore[];
  targetPct: number | null;
  targetLabel: string | null;
  /** #736: bar heights, aligned 1:1 with the plotted points. */
  hours?: readonly { pctOfMax: number }[];
  /** #736: the hours value drawn at full bar height, for the aria sentence. */
  hoursMax?: number;
  sample?: boolean;
}) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);
  const points = chartPoints(scores, { width: PLOT_WIDTH, height: PLOT_HEIGHT }).map((p) => ({
    ...p,
    px: PAD_LEFT + p.x,
    py: PAD_Y + p.y,
  }));
  const active = points.find((p) => p.id === activeId) ?? null;
  const bars =
    hours && points.length > 0 && hours.some((h) => h.pctOfMax > 0)
      ? points.map((p, i) => ({ px: p.px, pct: hours[i]?.pctOfMax ?? 0 }))
      : [];
  const baselineY = yFor(0);

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="img"
        aria-label={
          bars.length > 0
            ? t("progress.chart_aria_hours", { n: points.length, max: hoursMax ?? 0 })
            : t("progress.chart_aria", { n: points.length })
        }
        className="block h-auto w-full"
        onMouseLeave={() => setActiveId(null)}
      >
        {bars.map((bar, index) => (
          <rect
            key={index}
            x={bar.px - BAR_WIDTH / 2}
            y={baselineY - (bar.pct / 100) * PLOT_HEIGHT}
            width={BAR_WIDTH}
            height={(bar.pct / 100) * PLOT_HEIGHT}
            fill="color-mix(in oklab, var(--ink) 10%, transparent)"
          />
        ))}
        {GRID_PERCENTS.map((pct) => (
          <g key={pct}>
            <line
              x1={PAD_LEFT}
              x2={VIEW_WIDTH - PAD_RIGHT}
              y1={yFor(pct)}
              y2={yFor(pct)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={PAD_LEFT - 6}
              y={yFor(pct) + 3}
              textAnchor="end"
              fontSize={10}
              fill="var(--muted-foreground)"
            >
              {pct}%
            </text>
          </g>
        ))}
        {targetPct !== null ? (
          <line
            x1={PAD_LEFT}
            x2={VIEW_WIDTH - PAD_RIGHT}
            y1={yFor(targetPct)}
            y2={yFor(targetPct)}
            stroke="var(--ink)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        ) : null}
        {points.length > 1 ? (
          <polyline
            points={points.map((p) => `${p.px},${p.py}`).join(" ")}
            fill="none"
            stroke="var(--brand-link)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={sample ? "2 5" : undefined}
          />
        ) : null}
        {points.map((p) => (
          <g key={p.id}>
            <circle
              cx={p.px}
              cy={p.py}
              r={MARKER_R}
              fill="var(--brand-link)"
              stroke="var(--card)"
              strokeWidth={2}
            />
            {sample ? null : (
              <circle
                cx={p.px}
                cy={p.py}
                r={HIT_R}
                fill="transparent"
                tabIndex={0}
                aria-label={`${p.name}, ${p.pct}%`}
                className="cursor-pointer outline-none focus-visible:stroke-[color:var(--ink)] focus-visible:[stroke-width:2]"
                onMouseEnter={() => setActiveId(p.id)}
                onFocus={() => setActiveId(p.id)}
                onBlur={() => setActiveId(null)}
                onClick={() => setActiveId((id) => (id === p.id ? null : p.id))}
              />
            )}
          </g>
        ))}
      </svg>
      {bars.length > 0 ? (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <svg aria-hidden viewBox="0 0 12 2" className="h-0.5 w-3">
              <line x1="0" y1="1" x2="12" y2="1" stroke="var(--brand-link)" strokeWidth={2} />
            </svg>
            {t("progress.legend_score")}
          </span>
          <span className="inline-flex items-center gap-1">
            <svg aria-hidden viewBox="0 0 12 8" className="h-2 w-3">
              <rect
                width="12"
                height="8"
                rx="1"
                fill="color-mix(in oklab, var(--ink) 10%, transparent)"
              />
            </svg>
            {t("progress.legend_hours")}
          </span>
        </div>
      ) : null}
      {targetLabel ? (
        <figcaption className="mt-1 text-xs text-muted-foreground">{targetLabel}</figcaption>
      ) : null}
      <div role="status" className="mt-1 min-h-10 text-xs">
        {active ? (
          <>
            <p className="font-semibold [overflow-wrap:anywhere]">
              {active.name} · {active.pct}%{active.gradeLabel ? ` · ${active.gradeLabel}` : ""} ·{" "}
              {active.assessedOn}
            </p>
            {active.note ? (
              <p className="text-muted-foreground [overflow-wrap:anywhere]">{active.note}</p>
            ) : null}
          </>
        ) : null}
      </div>
    </figure>
  );
}
