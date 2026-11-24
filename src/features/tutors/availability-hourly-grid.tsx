import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";

import {
  GRID_DAYS,
  clipOccupiedToOpen,
  type GridDay,
  type HourlyOpenHours,
} from "@/features/tutors/availability-grid-model";
import {
  hourLabelAt,
  hourRangeLabelAt,
  shiftGridSlot,
  shiftOpenHours,
  shiftedGridRows,
} from "@/features/tutors/availability-zone";
import {
  DEFAULT_TUTOR_TIMEZONE,
  isDefaultTutorZone,
  resolveTutorTimezone,
  timezoneLabel,
} from "@/features/cases/tutor-timezone";
import { cn } from "@/lib/utils";

/**
 * Issue #768 (slice 1): the public weekly HOURLY availability grid on the
 * tutor profile — 7 day columns × hourly rows, with exactly two public
 * states: Open / 可約 (green, tappable) and Occupied / 已佔用 (ink, not
 * actionable). Occupied arrives pre-derived at read time from confirmed
 * lessons (fetchTutorOccupiedHours) and is clipped to base Open hours here, so
 * no private data (student names, lesson titles, earnings) ever renders.
 *
 * #798: the stored hours are HKT wall clock, so a tutor outside Hong Kong
 * reads their own schedule in their own zone — row labels, day columns and the
 * zone note all move together, and the request link still carries the stored
 * HKT slot. For the HKT default this is a byte-identical no-op.
 *
 * Tapping a green Open cell pre-fills that time into the tutor-request flow
 * via a URL param — no instant-book, and the cell itself is a plain link, so a
 * logged-out tap never hits a login wall on the cell. Mobile keeps the
 * #168 in-container horizontal scroll (no page overflow).
 */

const OPEN_CELL_CLASS =
  "border-[color:var(--brand-link)]/40 bg-[color:var(--brand-link)]/85 hover:bg-[color:var(--brand-link)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]";
// Same green cell, no hover/focus affordance: used when the profile's Request
// action is closed (fully booked / inactive), so Open stays visible but is not
// tappable.
const OPEN_CELL_STATIC_CLASS =
  "border-[color:var(--brand-link)]/40 bg-[color:var(--brand-link)]/85";
const OCCUPIED_CELL_CLASS = "border-[color:var(--ink)]/40 bg-[color:var(--ink)]/80";
const CLOSED_CELL_CLASS = "border-border bg-muted/50";

export function AvailabilityHourlyGrid({
  openHours,
  occupiedHours,
  tutorCode,
  allowPrefill = true,
  timezone,
  viewerTimezone,
  className,
}: {
  /** Base weekly Open hours (hourly column, or the legacy fallback read). */
  openHours: HourlyOpenHours;
  /** Confirmed-lesson overrides derived on read; clipped to Open hours. */
  occupiedHours: HourlyOpenHours;
  /** Public tutor code carried into the request form so the case keeps the
   * tutor the parent was viewing (issue #768). */
  tutorCode?: string | null;
  /** False when the profile's Request action is disabled: Open cells stay
   * visible but render as non-interactive divs (no link, no focus stop). */
  allowPrefill?: boolean;
  /** #798: the tutor's stored zone, already resolved from tutors.timezone. */
  timezone?: string | null;
  /** #798: the reader's own zone, when the browser can tell us. */
  viewerTimezone?: string | null;
  className?: string;
}) {
  const { t } = useTranslation();
  const tutorZone = resolveTutorTimezone(timezone ?? null);
  const converting = !isDefaultTutorZone(tutorZone);
  // Rows follow the tutor's clock: the unchanged 06:00–23:59 band for the HKT
  // default, the full day for a converted zone.
  const rows = shiftedGridRows(DEFAULT_TUTOR_TIMEZONE, tutorZone);
  const clipped = clipOccupiedToOpen(openHours, occupiedHours);
  const displayOpen = shiftOpenHours(openHours, DEFAULT_TUTOR_TIMEZONE, tutorZone);
  const displayOccupied = shiftOpenHours(clipped, DEFAULT_TUTOR_TIMEZONE, tutorZone);
  const hasOpenHours = GRID_DAYS.some((day) => displayOpen[day].length > 0);

  // #798: the request link must carry the STORED (HKT) slot, not the displayed
  // one, so the case keeps the hour every other surface reads. Built by
  // provenance instead of a reverse shift: a :30 offset zone cannot be
  // inverted from an hourly row label.
  const storedCellByDisplay = new Map<string, { day: GridDay; hour: number }>();
  if (converting) {
    GRID_DAYS.forEach((day, dayIndex) => {
      for (const hour of openHours[day]) {
        const slot = shiftGridSlot(dayIndex, hour, DEFAULT_TUTOR_TIMEZONE, tutorZone);
        storedCellByDisplay.set(`${slot.dayIndex}-${slot.hour}`, { day, hour });
      }
    });
  }

  const zoneNote =
    converting && viewerTimezone && viewerTimezone !== tutorZone
      ? t("profile.grid_zone_both", {
          tutorZone: timezoneLabel(tutorZone),
          viewerZone: timezoneLabel(viewerTimezone),
        })
      : t("profile.grid_zone_tutor", { zone: timezoneLabel(tutorZone) });

  return (
    <div className={className}>
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        {converting ? zoneNote : t("profile.grid_timezone_note")}
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
              {rows.map((row) => (
                <tr key={row}>
                  <th
                    scope="row"
                    className="pr-2 text-left text-[11px] leading-tight font-medium whitespace-nowrap text-muted-foreground sm:text-xs"
                  >
                    {hourLabelAt(row)}
                  </th>
                  {GRID_DAYS.map((day, dayIndex) => {
                    const isOccupied = displayOccupied[day].includes(row);
                    const isOpen = displayOpen[day].includes(row);
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
                    const openCellLabel = `${t(`profile.grid_day_${day}`)} ${hourRangeLabelAt(
                      row,
                    )}: ${t("profile.grid_cell_open")}`;
                    const stored = storedCellByDisplay.get(`${dayIndex}-${row}`);
                    if (!allowPrefill) {
                      return (
                        <td key={day} className="h-6">
                          <div
                            role="img"
                            aria-label={openCellLabel}
                            className={cn(
                              "flex h-6 w-full rounded-[4px] border",
                              OPEN_CELL_STATIC_CLASS,
                            )}
                          />
                        </td>
                      );
                    }
                    return (
                      <td key={day} className="h-6">
                        <Link
                          to="/case-request"
                          search={{
                            req_time: `${stored?.day ?? day}-${stored?.hour ?? row}`,
                            ...(converting ? { req_tz: tutorZone } : {}),
                            ...(tutorCode ? { tutor: tutorCode } : {}),
                          }}
                          aria-label={openCellLabel}
                          className={cn(
                            "flex h-6 w-full rounded-[4px] border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
                            OPEN_CELL_CLASS,
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
