import { useTranslation } from "react-i18next";

import {
  GRID_DAYS,
  GRID_SLOTS,
  countAvailableCells,
  gridSlotLabel,
  isGridEmpty,
  parseAvailabilityGrid,
  type GridCellState,
} from "@/features/tutors/availability-grid-model";
import { cn } from "@/lib/utils";

/**
 * Issue #116: weekly availability grid on the public tutor profile, in the
 * style of the TutorCircle reference. 7 day columns × 6 fixed 3-hour slots;
 * each cell is available (可補), partial (部分時段可) or unavailable (不可補),
 * from the tutor's self-serve grid (tutors.availability_grid). Read-only here
 * — tutors edit it in Dashboard → Availability.
 */

const STATE_CELL_CLASS: Record<GridCellState, string> = {
  a: "border-[color:var(--brand-link)]/40 bg-[color:var(--brand-link)]/85",
  p: "border-[color:var(--brand-link)]/25 bg-[color:var(--brand-link)]/30",
  u: "border-border bg-muted/50",
};

const STATE_LABEL_KEYS: Record<GridCellState, string> = {
  a: "profile.grid_cell_available",
  p: "profile.grid_cell_partial",
  u: "profile.grid_cell_unavailable",
};

export function AvailabilityGrid({
  grid: rawGrid,
  className,
}: {
  /** Raw JSONB off the tutor row — parsed defensively. */
  grid: unknown;
  className?: string;
}) {
  const { t } = useTranslation();
  const grid = parseAvailabilityGrid(rawGrid);

  if (isGridEmpty(grid) || countAvailableCells(grid) === 0) return null;

  return (
    <div className={className}>
      <div className="overflow-x-auto pb-1">
        <table
          className="w-full min-w-[560px] border-separate border-spacing-1 text-center"
          role="img"
          aria-label={t("profile.grid_aria")}
        >
          <thead>
            <tr>
              <th scope="col" className="w-[24%]" />
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
            {GRID_SLOTS.map((slot) => (
              <tr key={slot}>
                <th
                  scope="row"
                  className="pr-2 text-left text-[11px] leading-tight font-medium whitespace-nowrap text-muted-foreground sm:text-xs"
                >
                  {gridSlotLabel(slot, t)}
                </th>
                {GRID_DAYS.map((day) => {
                  const state = grid[day][GRID_SLOTS.indexOf(slot)];
                  return (
                    <td key={day} className="h-8">
                      <div
                        className={cn("h-8 w-full rounded-[4px] border", STATE_CELL_CLASS[state])}
                        title={t(STATE_LABEL_KEYS[state])}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        {(["a", "p", "u"] as const).map((state) => (
          <span key={state} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn("inline-block h-3 w-3 rounded-[3px] border", STATE_CELL_CLASS[state])}
            />
            {t(STATE_LABEL_KEYS[state])}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("profile.time_window_disclaimer")}</p>
    </div>
  );
}
