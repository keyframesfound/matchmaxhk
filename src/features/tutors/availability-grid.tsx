import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { GRID_DAYS } from "@/features/tutors/availability-grid-model";
import {
  countOpenHours,
  mergeOccupied,
  projectLegacyGrid,
  type HourCellState,
  type HourlyDay,
} from "@/features/tutors/availability-hours-model";
import { cn } from "@/lib/utils";

/**
 * Issue #768 Part 1: weekly availability on the public tutor profile.
 *
 * The old 7×6 three-hour grid (issue #116) became a 7-day × hourly grid with
 * only two public states: Open and Occupied. Only the teaching window
 * 06:00–24:00 renders (hours 6..23), matching the legacy slot rows, so the
 * table stays readable and never invents early-morning availability.
 *
 * Until get_tutor_public_availability is wired, `states` is absent and the
 * component projects tutors.availability_grid into hourly cells, so public
 * profiles keep rendering before the migration lands.
 */

/** Teaching window rendered here: 06:00 up to 24:00 (exclusive end hour). */
const TEACHING_START_HOUR = 6;
const TEACHING_END_HOUR = 24;
const TEACHING_HOURS = Array.from(
  { length: TEACHING_END_HOUR - TEACHING_START_HOUR },
  (_, index) => TEACHING_START_HOUR + index,
);

const STATE_CELL_CLASS: Record<HourCellState, string> = {
  open: "border-[color:var(--brand-link)]/40 bg-[color:var(--brand-link)]/85",
  occupied: "border-border bg-muted",
  closed: "border-border bg-transparent",
};

/** Only the two public states get a label; closed stays unlabelled. */
const VISIBLE_STATE_LABEL_KEY: Record<Exclude<HourCellState, "closed">, string> = {
  open: "profile.grid_cell_open",
  occupied: "profile.grid_cell_occupied",
};

const LEGEND_ENTRIES = [
  { state: "open", labelKey: "profile.grid_cell_open" },
  { state: "occupied", labelKey: "profile.grid_cell_occupied" },
] as const;

const OPEN_CELL_FOCUS_CLASS =
  "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-link)] focus-visible:ring-offset-1";

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export type AvailabilityGridProps = {
  /** Legacy JSONB off the tutor row, still the fallback source. */
  grid: unknown;
  className?: string;
  /** New hourly states from get_tutor_public_availability; absent until wired. */
  states?: Record<HourlyDay, HourCellState[]> | null;
  /** Called when a visitor activates an Open hour. Absent = not interactive. */
  onPickHour?: (day: HourlyDay, hour: number) => void;
};

export function AvailabilityGrid({
  grid: rawGrid,
  className,
  states = null,
  onPickHour,
}: AvailabilityGridProps) {
  const { t } = useTranslation();
  // Source of truth: the RPC states when present, otherwise the projected
  // legacy grid (open/closed only, never Occupied) so profiles render
  // pre-migration.
  const resolvedStates = useMemo(
    () => states ?? mergeOccupied(projectLegacyGrid(rawGrid), []),
    [states, rawGrid],
  );
  // `const` binding so the button handler keeps its narrowed type in a closure.
  const pickHour = onPickHour;

  // Issue #768: the availability section is always visible on the public
  // profile, so a grid with nothing open shows a copy empty state instead of
  // collapsing the section away.
  if (countOpenHours(resolvedStates) === 0) {
    return (
      <p className="text-sm leading-relaxed text-muted-foreground">{t("profile.grid_empty")}</p>
    );
  }

  return (
    <div className={className}>
      <div className="overflow-x-auto pb-1">
        <table
          className="w-full min-w-[560px] border-separate border-spacing-1 text-center"
          aria-label={t("profile.grid_aria")}
        >
          <thead>
            <tr>
              <th scope="col" className="w-[64px]" />
              {GRID_DAYS.map((day) => (
                <th
                  key={day}
                  scope="col"
                  className="pb-1 text-xs font-bold text-[color:var(--ink)] sm:text-sm"
                >
                  {t(`profile.grid_day_${day}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TEACHING_HOURS.map((hour) => (
              <tr key={hour}>
                <th
                  scope="row"
                  className="pr-2 text-left text-[11px] leading-tight font-medium whitespace-nowrap text-muted-foreground tabular-nums sm:text-xs"
                >
                  {formatHour(hour)}
                </th>
                {GRID_DAYS.map((day) => {
                  const state = resolvedStates[day][hour];
                  const cellClass = cn(
                    "block h-8 w-full rounded-[4px] border",
                    STATE_CELL_CLASS[state],
                  );

                  if (state === "open" && pickHour) {
                    return (
                      <td key={day} className="p-0">
                        <button
                          type="button"
                          onClick={() => pickHour(day, hour)}
                          aria-label={`${t(`profile.grid_day_${day}`)} ${formatHour(hour)} · ${t("profile.grid_cell_open")}`}
                          className={cn(cellClass, OPEN_CELL_FOCUS_CLASS)}
                        />
                      </td>
                    );
                  }

                  // Occupied is inert: no handler, no tooltip, never reveals
                  // anything about the lesson. Closed is an empty neutral cell.
                  return (
                    <td key={day} className="p-0">
                      <span className={cellClass}>
                        {state === "closed" ? null : (
                          <span className="sr-only">{t(VISIBLE_STATE_LABEL_KEY[state])}</span>
                        )}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        {LEGEND_ENTRIES.map((entry) => (
          <span key={entry.state} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                "inline-block h-3 w-3 rounded-[3px] border",
                STATE_CELL_CLASS[entry.state],
              )}
            />
            {t(entry.labelKey)}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("profile.time_window_disclaimer")}</p>
    </div>
  );
}
