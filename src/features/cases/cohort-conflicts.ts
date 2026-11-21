/**
 * Issue #768: coincidence guard for full group cohorts.
 *
 * A cohort that has every seat taken publishes its weekly session hours as
 * Occupied on the tutor's public grid (`availability-occupancy`), so the
 * scheduling guards must refuse those same hours: otherwise a 1-on-1 lesson
 * can be confirmed on top of a full small-group class. "Full" is the same
 * `cohortAvailability(...).state === "full"` rule the booking flow and the
 * public grid use, so the three surfaces can never disagree.
 *
 * Sessions are the tutors.availability_grid_hourly contract (`{mon:[6,7],...}`,
 * days mon..sun, Open START hours 6..23 HKT). Pure, no DB.
 */

import { hktWeekdayIndex } from "@/features/cases/sor";
import {
  GRID_DAYS,
  HOURLY_GRID_END_HOUR,
  HOURLY_GRID_START_HOUR,
  type HourlyOpenHours,
} from "@/features/tutors/availability-grid-model";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const HKT_OFFSET_MS = 8 * HOUR_MS;

/** HKT calendar-day number for an instant (days since the epoch, HKT). */
function hktDayIndex(ms: number): number {
  return Math.floor((ms + HKT_OFFSET_MS) / DAY_MS);
}

/** The instant of 00:00 HKT on that HKT calendar day. */
function hktMidnightMs(dayIndex: number): number {
  return dayIndex * DAY_MS - HKT_OFFSET_MS;
}

/**
 * True when [startsAt, startsAt + durationMin) overlaps any hourly cell a full
 * cohort claims (issue #768). Each Open cell is expanded to that weekday's
 * occurrence in HKT, so a 17:00 cell blocks a 17:30 lesson and a 18:00 lesson
 * still starts free. Every HKT day the interval touches is checked, so a
 * lesson running past midnight sees the next day's early cells too. Cohort
 * time is time, not mode: an online lesson conflicts just the same.
 */
export function cohortSessionConflicts(
  startsAt: Date,
  durationMin: number,
  sessions: HourlyOpenHours,
): boolean {
  const cStart = startsAt.getTime();
  if (!Number.isFinite(cStart)) return false;
  const cEnd = cStart + Math.max(0, durationMin) * MINUTE_MS;
  if (cEnd <= cStart) return false;

  const firstDay = hktDayIndex(cStart);
  // A real lesson crosses at most one HKT midnight; walk every touched day so
  // an unusually long block is still caught.
  const lastDay = hktDayIndex(cEnd - 1);
  for (let day = firstDay; day <= lastDay; day += 1) {
    const midnight = hktMidnightMs(day);
    const dayKey = GRID_DAYS[hktWeekdayIndex(new Date(midnight))];
    if (!dayKey) continue;
    for (const hour of sessions[dayKey]) {
      if (hour < HOURLY_GRID_START_HOUR || hour >= HOURLY_GRID_END_HOUR) continue;
      const cellStart = midnight + hour * HOUR_MS;
      if (cStart < cellStart + HOUR_MS && cellStart < cEnd) return true;
    }
  }
  return false;
}
