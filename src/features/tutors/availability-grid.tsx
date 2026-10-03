import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { PreferredTimeWindow } from "@/features/tutors/queries";

/**
 * Issue #116: weekly availability grid on the public tutor profile, in the
 * style of the TutorCircle reference. Two time bands per day-part (early /
 * late) across the five weekdays and the weekend; each cell is derived from
 * the tutor's self-serve preferred time windows (issue #103 data) — no new
 * database fields. Cells for windows the tutor did not select render as
 * "not available"; there is no partial state because the source data is
 * whole-window only.
 */

const GRID_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

type GridDay = (typeof GRID_DAYS)[number];

/** Cell state for one day × band intersection. */
type CellState = "available" | "unavailable";

/** Early band (first half) and late band (second half) per time window. */
const WINDOW_BANDS: Record<PreferredTimeWindow, { early: boolean; late: boolean }> = {
  weekday_afternoon: { early: true, late: true },
  weekday_evening: { early: true, late: true },
  weekend_morning: { early: true, late: true },
  weekend_afternoon: { early: true, late: true },
};

const WEEKDAY_WINDOWS: PreferredTimeWindow[] = ["weekday_afternoon", "weekday_evening"];

const WEEKEND_WINDOWS: PreferredTimeWindow[] = ["weekend_morning", "weekend_afternoon"];

export function AvailabilityGrid({
  windows,
  className,
}: {
  windows: PreferredTimeWindow[];
  className?: string;
}) {
  const { t } = useTranslation();

  if (windows.length === 0) return null;

  const weekdayActive = windows.filter((window) => WEEKDAY_WINDOWS.includes(window));
  const weekendActive = windows.filter((window) => WEEKEND_WINDOWS.includes(window));

  const cellState = (day: GridDay): CellState => {
    const isWeekend = day === "sat" || day === "sun";
    const active = isWeekend ? weekendActive : weekdayActive;
    return active.length > 0 ? "available" : "unavailable";
  };

  const dayLabel = (day: GridDay) => t(`profile.grid_day_${day}`);

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table
          className="w-full min-w-[420px] border-separate border-spacing-1 text-center"
          role="img"
          aria-label={t("profile.grid_aria")}
        >
          <thead>
            <tr>
              <th scope="col" className="w-[26%]" />
              {GRID_DAYS.map((day) => (
                <th
                  key={day}
                  scope="col"
                  className="pb-1 text-xs font-bold text-[color:var(--ink)] sm:text-sm"
                >
                  {dayLabel(day)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(["early", "late"] as const).map((band) => (
              <tr key={band}>
                <th
                  scope="row"
                  className="pr-2 text-left text-xs font-medium text-muted-foreground sm:text-sm"
                >
                  {t(band === "early" ? "profile.grid_band_early" : "profile.grid_band_late")}
                </th>
                {GRID_DAYS.map((day) => {
                  const state = cellState(day);
                  return (
                    <td key={day} className="h-9">
                      <div
                        className={cn(
                          "h-9 w-full rounded-[4px] border",
                          state === "available"
                            ? "border-[color:var(--brand-link)]/40 bg-[color:var(--brand-link)]/85"
                            : "border-border bg-muted/50",
                        )}
                        title={t(
                          state === "available"
                            ? "profile.grid_cell_available"
                            : "profile.grid_cell_unavailable",
                        )}
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
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-3 w-3 rounded-[3px] border border-[color:var(--brand-link)]/40 bg-[color:var(--brand-link)]/85"
          />
          {t("profile.grid_cell_available")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-3 w-3 rounded-[3px] border border-border bg-muted/50"
          />
          {t("profile.grid_cell_unavailable")}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("profile.time_window_disclaimer")}</p>
    </div>
  );
}
