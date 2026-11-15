import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";

import {
  GRID_DAYS,
  HOURLY_GRID_HOURS,
  HOURLY_GRID_START_HOUR,
  clipOccupiedToOpen,
  hourlyHourLabel,
  hourlyRangeLabel,
  type HourlyOpenHours,
} from "@/features/tutors/availability-grid-model";
import { cn } from "@/lib/utils";

/**
 * Issue #768 (slice 1): the public weekly HOURLY availability grid on the
 * tutor profile — 7 day columns × hourly rows in HKT, with exactly two public
 * states: Open / 可約 (green, tappable) and Occupied / 已佔用 (ink, not
 * actionable). Occupied arrives pre-derived at read time from confirmed
 * lessons (fetchTutorOccupiedHours) and is clipped to base Open hours here, so
 * no private data (student names, lesson titles, earnings) ever renders.
 *
 * Tapping a green Open cell pre-fills that time into the tutor-request flow
 * via a URL param — no instant-book, and the cell itself is a plain link, so a
 * logged-out tap never hits a login wall on the cell. Mobile keeps the
 * #168 in-container horizontal scroll (no page overflow).
 */

const OPEN_CELL_CLASS =
  "border-[color:var(--brand-link)]/40 bg-[color:var(--brand-link)]/85 hover:bg-[color:var(--brand-link)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]";
const OCCUPIED_CELL_CLASS = "border-[color:var(--ink)]/40 bg-[color:var(--ink)]/80";
const CLOSED_CELL_CLASS = "border-border bg-muted/50";

export function AvailabilityHourlyGrid({
  openHours,
  occupiedHours,
  className,
}: {
  /** Base weekly Open hours (hourly column, or the legacy fallback read). */
  openHours: HourlyOpenHours;
  /** Confirmed-lesson overrides derived on read; clipped to Open hours. */
  occupiedHours: HourlyOpenHours;
  className?: string;
}) {
  const { t } = useTranslation();
  const occupied = clipOccupiedToOpen(openHours, occupiedHours);
  const hasOpenHours = GRID_DAYS.some((day) => openHours[day].length > 0);

  return (
    <div className={className}>
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        {t("profile.grid_timezone_note")}
      </p>
      {hasOpenHours ? (
        <div className="overflow-x-auto pb-1">
          <table
            className="w-full min-w-[620px] border-separate border-spacing-1 text-center"
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
              {Array.from({ length: HOURLY_GRID_HOURS }, (_, index) => {
                const hour = HOURLY_GRID_START_HOUR + index;
                return (
                  <tr key={hour}>
                    <th
                      scope="row"
                      className="pr-2 text-left text-[11px] leading-tight font-medium whitespace-nowrap text-muted-foreground sm:text-xs"
                    >
                      {hourlyHourLabel(hour)}
                    </th>
                    {GRID_DAYS.map((day) => {
                      const isOccupied = occupied[day].includes(hour);
                      const isOpen = openHours[day].includes(hour);
                      if (!isOpen) {
                        return (
                          <td key={day} className="h-6">
                            <div
                              aria-hidden="true"
                              className={cn("h-6 w-full rounded-[4px] border", CLOSED_CELL_CLASS)}
                            />
                          </td>
                        );
                      }
                      if (isOccupied) {
                        return (
                          <td key={day} className="h-6">
                            <div
                              className={cn("h-6 w-full rounded-[4px] border", OCCUPIED_CELL_CLASS)}
                              title={t("profile.grid_cell_occupied")}
                            />
                          </td>
                        );
                      }
                      return (
                        <td key={day} className="h-6">
                          <Link
                            to="/tutor-requests"
                            search={{ post: true, req_time: `${day}-${hour}` }}
                            aria-label={`${t(`profile.grid_day_${day}`)} ${hourlyRangeLabel(hour)}: ${t("profile.grid_cell_open")}`}
                            className={cn(
                              "flex h-6 w-full rounded-[4px] border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
                              OPEN_CELL_CLASS,
                            )}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-sm border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {t("profile.availability_empty")}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn("inline-block h-3 w-3 rounded-[3px] border", OPEN_CELL_CLASS)}
          />
          {t("profile.grid_cell_open")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn("inline-block h-3 w-3 rounded-[3px] border", OCCUPIED_CELL_CLASS)}
          />
          {t("profile.grid_cell_occupied")}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("profile.time_window_disclaimer")}</p>
    </div>
  );
}
