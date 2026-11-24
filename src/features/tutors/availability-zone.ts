import { isDefaultTutorZone, resolveTutorTimezone } from "@/features/cases/tutor-timezone";
import {
  GRID_DAYS,
  HOURLY_GRID_HOURS,
  HOURLY_GRID_START_HOUR,
  emptyHourlyOpenHours,
  type HourlyOpenHours,
} from "@/features/tutors/availability-grid-model";

/**
 * #798: reading the weekly availability grid in the tutor's own zone.
 *
 * The stored hours are HKT wall clock on purpose (see
 * docs/tutor-timezone-conversion.md and the join form's AC-9 note): a Sydney
 * tutor who picks 18:00 has stored 18:00 HKT, not 18:00 Sydney. Nothing here
 * writes back — this is the render boundary only, so no existing tutor's grid
 * moves and no stored value is ever re-interpreted.
 *
 * For the 100% HKT roster the shift is exactly zero, so every surface keeps
 * the numbers it shows today.
 */

/** Minutes east of UTC for a zone at an instant (handles :30 / :45 zones). */
export function zoneOffsetMinutes(zone: string, at: Date = new Date()): number {
  const resolved = resolveTutorTimezone(zone);
  const stamp = Math.floor(at.getTime() / 60000) * 60000;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: resolved,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date(stamp));
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((entry) => entry.type === type)?.value ?? "0");
    const asUtc = Date.UTC(
      part("year"),
      part("month") - 1,
      part("day"),
      part("hour"),
      part("minute"),
    );
    return Math.round((asUtc - stamp) / 60000);
  } catch {
    return 0;
  }
}

/** Whole-minute wall-clock shift from one zone to another at an instant. */
export function zoneShiftMinutes(fromZone: string, toZone: string, at: Date = new Date()): number {
  return zoneOffsetMinutes(toZone, at) - zoneOffsetMinutes(fromZone, at);
}

export type ShiftedSlot = {
  /** 0 = Monday … 6 = Sunday, in the target zone. */
  dayIndex: number;
  /** 0–23, in the target zone. */
  hour: number;
  /** 0–59 leftover minutes; non-zero only for :30 / :45 offset zones. */
  minute: number;
};

/**
 * Maps one weekly grid slot (day + start hour, as stored in `fromZone`) onto
 * the same instant's wall clock in `toZone`. The week wraps: Sunday 23:00 HKT
 * is Monday 02:00 in Sydney, so the day index moves with the hour.
 */
export function shiftGridSlot(
  dayIndex: number,
  hour: number,
  fromZone: string,
  toZone: string,
  at: Date = new Date(),
): ShiftedSlot {
  const weekMinutes = 7 * 24 * 60;
  const shift = zoneShiftMinutes(fromZone, toZone, at);
  const start = dayIndex * 24 * 60 + hour * 60;
  const shifted = (((start + shift) % weekMinutes) + weekMinutes) % weekMinutes;
  return {
    dayIndex: Math.floor(shifted / (24 * 60)),
    hour: Math.floor((shifted % (24 * 60)) / 60),
    minute: shifted % 60,
  };
}

/**
 * Remaps a whole Open/Occupied hour map into another zone. Closed days stay
 * closed; a cell that crosses midnight lands on the next day's column.
 */
export function shiftOpenHours(
  hours: HourlyOpenHours,
  fromZone: string,
  toZone: string,
  at: Date = new Date(),
): HourlyOpenHours {
  if (isDefaultTutorZone(fromZone) && isDefaultTutorZone(toZone)) return hours;
  const shifted = emptyHourlyOpenHours();
  GRID_DAYS.forEach((day, dayIndex) => {
    for (const hour of hours[day]) {
      const slot = shiftGridSlot(dayIndex, hour, fromZone, toZone, at);
      const targetDay = GRID_DAYS[slot.dayIndex];
      if (!shifted[targetDay].includes(slot.hour)) shifted[targetDay].push(slot.hour);
    }
  });
  for (const day of GRID_DAYS) shifted[day].sort((a, b) => a - b);
  return shifted;
}

/**
 * The row hours for a grid rendered in `toZone`.
 *
 * No conversion: the same 06:00–23:59 band the HKT grid has always shown, so
 * the existing roster renders byte-identically. Converted: the full 00:00–23:59
 * day in the display zone, because the shifted band wraps past midnight and a
 * band with a hole in it (09:00–02:59, say) reads like missing data. Cells are
 * placed by their whole display hour; the leftover minutes of a :30 zone stay
 * with the zone label, which carries the real offset.
 */
export function shiftedGridRows(fromZone: string, toZone: string, at: Date = new Date()): number[] {
  if (zoneShiftMinutes(fromZone, toZone, at) === 0) {
    return Array.from({ length: HOURLY_GRID_HOURS }, (_, index) => HOURLY_GRID_START_HOUR + index);
  }
  return Array.from({ length: 24 }, (_, hour) => hour);
}

/** "18:00" / "18:30" — the row label in the display zone. */
export function hourLabelAt(hour: number, minute = 0): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** "18:00 – 19:00" — the cell range label in the display zone. */
export function hourRangeLabelAt(hour: number, minute = 0): string {
  const endMinute = (hour * 60 + minute + 60) % (24 * 60);
  return `${hourLabelAt(hour, minute)} – ${hourLabelAt(
    Math.floor(endMinute / 60),
    endMinute % 60,
  )}`;
}
