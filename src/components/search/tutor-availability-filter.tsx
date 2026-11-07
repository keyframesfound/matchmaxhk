import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { GRID_DAYS, type GridDay } from "@/features/tutors/availability-grid-model";
import {
  AVAIL_BANDS,
  joinAvailParam,
  parseAvailBands,
  parseAvailDays,
  type AvailBand,
} from "@/features/tutors/availability-filter";

/**
 * #605 §3.11: Availability in More Filters (never a hybrid-bar "When" axis).
 * Weekday + time-band chips over the tutors' soft weekly grid. The helper
 * line states these are soft prefs; Case Manager holds the real schedule.
 */

const chipClass = (active: boolean) =>
  cn(
    "inline-flex h-9 min-w-11 items-center justify-center rounded-full border px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
    active
      ? "border-[color:var(--ink)] bg-[color:var(--ink)]/5 text-[color:var(--ink)]"
      : "border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-[color:var(--ink)]/70 hover:border-[color:var(--ink)]/30 hover:text-[color:var(--ink)]",
  );

export type AvailabilityDraft = { avail_days?: string; avail_bands?: string };

export function availabilityFilterCount(draft: AvailabilityDraft): number {
  return parseAvailDays(draft.avail_days).length > 0 ||
    parseAvailBands(draft.avail_bands).length > 0
    ? 1
    : 0;
}

export function AvailabilityFilterContent({
  draft,
  onDraftChange,
  helper,
}: {
  draft: AvailabilityDraft;
  onDraftChange: (patch: AvailabilityDraft) => void;
  /** Scope-specific helper line (cases match the parent's preferred times). */
  helper?: string;
}) {
  const { t } = useTranslation();
  const days = parseAvailDays(draft.avail_days);
  const bands = parseAvailBands(draft.avail_bands);

  const toggleDay = (day: GridDay) => {
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    onDraftChange({ avail_days: joinAvailParam(GRID_DAYS.filter((d) => next.includes(d))) });
  };
  const toggleBand = (band: AvailBand) => {
    const next = bands.includes(band) ? bands.filter((b) => b !== band) : [...bands, band];
    onDraftChange({ avail_bands: joinAvailParam(AVAIL_BANDS.filter((b) => next.includes(b))) });
  };

  return (
    <div className="space-y-3">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t("explore_search.avail_days")}
      >
        {GRID_DAYS.map((day) => (
          <button
            key={day}
            type="button"
            aria-pressed={days.includes(day)}
            onClick={() => toggleDay(day)}
            className={chipClass(days.includes(day))}
          >
            {t(`explore_search.day_${day}`)}
          </button>
        ))}
      </div>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t("explore_search.avail_bands")}
      >
        {AVAIL_BANDS.map((band) => (
          <button
            key={band}
            type="button"
            aria-pressed={bands.includes(band)}
            onClick={() => toggleBand(band)}
            className={chipClass(bands.includes(band))}
          >
            {t(`explore_search.band_${band}`)}
          </button>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {helper ?? t("explore_search.avail_helper")}
      </p>
    </div>
  );
}

/** #605: multi-subject OR by default; this switches to "must teach all". */
export function SubjectMatchToggle({
  value,
  onChange,
}: {
  value: "and" | "or" | undefined;
  onChange: (next: "and" | undefined) => void;
}) {
  const { t } = useTranslation();
  const all = value === "and";
  return (
    <div className="space-y-1.5">
      <button
        type="button"
        role="switch"
        aria-checked={all}
        onClick={() => onChange(all ? undefined : "and")}
        className={chipClass(all)}
      >
        {t("explore_search.subject_match_all")}
      </button>
      <p className="text-xs text-muted-foreground">{t("explore_search.subject_match_hint")}</p>
    </div>
  );
}
