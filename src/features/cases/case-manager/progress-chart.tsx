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
 * #653 grade curve: one series, so the heading names it and there is no legend.
 * Plain SVG, no chart library. The assessment log below is its table view.
 */
export function ProgressChart({
  scores,
  targetPct,
  targetLabel,
  sample = false,
}: {
  scores: readonly ChartScore[];
  targetPct: number | null;
  targetLabel: string | null;
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

  return (
    <figure className="relative m-0">
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="img"
        aria-label={t("progress.chart_aria", { n: points.length })}
        className="block h-auto w-full"
        onMouseLeave={() => setActiveId(null)}
      >
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
                className="cursor-pointer outline-none focus-visible:stroke-[color:var(--ink)]"
                onMouseEnter={() => setActiveId(p.id)}
                onFocus={() => setActiveId(p.id)}
                onBlur={() => setActiveId(null)}
                onClick={() => setActiveId(p.id)}
              />
            )}
          </g>
        ))}
      </svg>
      {targetLabel ? (
        <figcaption className="mt-1 text-xs text-muted-foreground">{targetLabel}</figcaption>
      ) : null}
      {active ? (
        <div
          role="status"
          className="mm-overlay-lift pointer-events-none absolute z-10 max-w-[70%] rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs"
          style={{
            left: `${Math.min((active.px / VIEW_WIDTH) * 100, 60)}%`,
            top: 0,
          }}
        >
          <p className="font-semibold [overflow-wrap:anywhere]">{active.name}</p>
          <p>
            {active.pct}%{active.gradeLabel ? ` · ${active.gradeLabel}` : ""} · {active.assessedOn}
          </p>
          {active.note ? (
            <p className="text-muted-foreground [overflow-wrap:anywhere]">{active.note}</p>
          ) : null}
        </div>
      ) : null}
    </figure>
  );
}
