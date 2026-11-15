import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { ScheduleSyncPanel, useScheduleSyncContext } from "@/features/cases/schedule-fit-ui";
import { GRID_DAYS, type GridDay } from "@/features/tutors/availability-grid-model";
import {
  AVAIL_BANDS,
  AVAIL_MODES,
  dateRangeWeekdays,
  joinAvailParam,
  parseAvailBands,
  parseAvailDate,
  parseAvailDays,
  parseAvailMode,
  type AvailBand,
  type AvailMode,
} from "@/features/tutors/availability-filter";

/**
 * #605 §3.11 / #771 §2.2: Availability in More Filters (never a hybrid-bar
 * "When" axis). Schedule mode chips (Any / Specific times / Flexible), then
 * weekday + time-band chips over the tutors' soft weekly grid, then an
 * optional HKT date range. The helper line states these are soft prefs;
 * Case Manager holds the real schedule.
 */

const chipClass = (active: boolean) =>
  cn(
    "inline-flex h-9 min-w-11 items-center justify-center rounded-full border px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
    active
      ? "border-[color:var(--ink)] bg-[color:var(--ink)]/5 text-[color:var(--ink)]"
      : "border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-[color:var(--ink)]/70 hover:border-[color:var(--ink)]/30 hover:text-[color:var(--ink)]",
  );

const dateInputClass =
  "h-9 w-full min-w-0 rounded-xl border border-[color:var(--ink)]/15 bg-[color:var(--surface)] px-2.5 text-sm font-medium text-[color:var(--ink)] transition-[border-color,background-color] focus:border-ring focus:bg-[color:var(--surface)] focus:outline-none focus:ring-2 focus:ring-ring";

export type AvailabilityDraft = {
  avail_days?: string;
  avail_bands?: string;
  avail_mode?: "specific" | "flexible";
  avail_date_from?: string;
  avail_date_to?: string;
};

/** Badge count: the schedule mode and the slot picks count separately. */
export function availabilityFilterCount(draft: AvailabilityDraft): number {
  const mode = parseAvailMode(draft.avail_mode);
  const slots =
    parseAvailDays(draft.avail_days).length > 0 ||
    parseAvailBands(draft.avail_bands).length > 0 ||
    Boolean(parseAvailDate(draft.avail_date_from) && parseAvailDate(draft.avail_date_to));
  return (slots ? 1 : 0) + (mode ? 1 : 0);
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
  const scheduleSync = useScheduleSyncContext();
  const days = parseAvailDays(draft.avail_days);
  const bands = parseAvailBands(draft.avail_bands);
  const mode = parseAvailMode(draft.avail_mode);
  // A parent with no fixed slots is not narrowed by weekday / band / date.
  const slotsActive = mode !== "flexible";
  const dateFrom = parseAvailDate(draft.avail_date_from);
  const dateTo = parseAvailDate(draft.avail_date_to);
  const rangeDays = dateRangeWeekdays(dateFrom, dateTo);

  const toggleDay = (day: GridDay) => {
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    onDraftChange({ avail_days: joinAvailParam(GRID_DAYS.filter((d) => next.includes(d))) });
  };
  const toggleBand = (band: AvailBand) => {
    const next = bands.includes(band) ? bands.filter((b) => b !== band) : [...bands, band];
    onDraftChange({ avail_bands: joinAvailParam(AVAIL_BANDS.filter((b) => next.includes(b))) });
  };
  const setMode = (next: AvailMode | undefined) => {
    onDraftChange({
      avail_mode: next,
      // Flexible drops the slot prefs it makes meaningless.
      ...(next === "flexible"
        ? {
            avail_days: undefined,
            avail_bands: undefined,
            avail_date_from: undefined,
            avail_date_to: undefined,
          }
        : {}),
    });
  };

  const modeOptions: Array<{ value: AvailMode | undefined; label: string }> = [
    { value: undefined, label: t("explore_search.avail_mode_any") },
    ...AVAIL_MODES.map((value) => ({
      value,
      label: t(
        value === "specific"
          ? "explore_search.avail_mode_specific"
          : "explore_search.avail_mode_flexible",
      ),
    })),
  ];

  return (
    <div className="space-y-3">
      {/* #659: the parent's Case Manager windows, editable for this session. */}
      {scheduleSync ? (
        <ScheduleSyncPanel sync={scheduleSync.sync} isLoading={scheduleSync.isLoading} />
      ) : null}
      <div
        className="flex flex-wrap gap-2"
        role="radiogroup"
        aria-label={t("explore_search.avail_mode_title")}
      >
        {modeOptions.map((option) => {
          const active = (option.value ?? undefined) === mode;
          return (
            <button
              key={option.value ?? "any"}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMode(option.value)}
              className={chipClass(active)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {slotsActive ? (
        <>
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
          {/* #771 §2.2: optional HKT date range; empty = ignore dates. */}
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="block text-xs font-semibold text-[color:var(--ink)]/70">
                {t("explore_search.avail_date_from")}
              </span>
              <input
                type="date"
                value={dateFrom ?? ""}
                max={dateTo ?? undefined}
                onChange={(event) =>
                  onDraftChange({ avail_date_from: event.target.value || undefined })
                }
                className={dateInputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs font-semibold text-[color:var(--ink)]/70">
                {t("explore_search.avail_date_to")}
              </span>
              <input
                type="date"
                value={dateTo ?? ""}
                min={dateFrom ?? undefined}
                onChange={(event) =>
                  onDraftChange({ avail_date_to: event.target.value || undefined })
                }
                className={dateInputClass}
              />
            </label>
          </div>
          {rangeDays.length > 0 ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("explore_search.avail_date_range", {
                days: rangeDays
                  .map((day) => t(`explore_search.day_${day}`))
                  .join(t("explore_search.list_sep")),
              })}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("explore_search.avail_flexible_hint")}
        </p>
      )}
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
