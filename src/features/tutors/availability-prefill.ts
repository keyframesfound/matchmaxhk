import { GRID_DAYS } from "./availability-grid-model";
import type { HourlyDay } from "./availability-hours-model";

/**
 * Issue #768 follow-up: a tutor profile hourly slot links back to the request
 * board with a fixed URL contract,
 *
 *   /tutor-requests?post=true&day=mon&hour=14
 *
 * and the request form pre-fills the parent's requested time from it. This is
 * a preference, never an instant booking: the tutor still confirms the slot
 * (tutor_profiles.time_window_disclaimer carries the same promise).
 *
 * The teaching window is 06:00 to 24:00 HKT (the legacy 3-hour grid runs
 * 06-09 .. 21-24), so hours 6..23 are the only valid values. Anything outside
 * that, a partial number, an unknown day or a missing half is MALFORMED and
 * parses to null rather than being clamped: a clamped 03:00 would silently
 * become 06:00 and book a slot the visitor never picked.
 */

/** First hour index a lesson can start at (06:00 HKT). */
const TEACHING_START_HOUR = 6;
/** Last hour index a lesson can start at (23:00 HKT, ending 24:00). */
const TEACHING_END_HOUR = 23;

/** A parsed `?day=&hour=` pair, or null when the URL carried no usable slot. */
export type AvailabilityPrefill = { day: HourlyDay; hour: number } | null;

function isHourlyDay(value: unknown): value is HourlyDay {
  return typeof value === "string" && (GRID_DAYS as readonly string[]).includes(value);
}

/** `?hour=` arrives as a string from the URL; numbers are accepted from
 *  already-parsed search state. Only bare integers are valid. */
function hourText(value: unknown): string | null {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/**
 * Validate raw search params into a prefill.
 *
 * Returns null for anything malformed: a missing `day` or `hour`, an unknown
 * day, a non-integer hour, an hour before 6 or after 23. Presenting the user
 * with a guessed slot is worse than presenting none.
 */
export function parseAvailabilityPrefill(search: Record<string, unknown>): AvailabilityPrefill {
  const { day, hour } = search;
  if (!isHourlyDay(day)) return null;
  const raw = hourText(hour);
  // Bare digits only: "14", "07". "14:00", "2pm", " 14 " (trimmed to "14") ok,
  // decimals and signs fall out here.
  if (raw === null || !/^\d{1,2}$/.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return null;
  if (parsed < TEACHING_START_HOUR || parsed > TEACHING_END_HOUR) return null;
  return { day, hour: parsed };
}

/** `14` -> "14:00". The end of the slot is the next hour (24:00 is the
 *  teaching window's close, so hour 23 reads 23:00–24:00). */
function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/**
 * Human label for the chosen slot, e.g. "Mon 14:00–15:00".
 *
 * The day name reuses the tutor-profile grid vocabulary
 * (`profile.grid_day_mon` .. `profile.grid_day_sun`), so the label matches the
 * profile the visitor clicked from. The range separator is a locale-neutral en
 * dash, the same one `experience.range_ended` uses.
 */
export function prefillLabel(prefill: AvailabilityPrefill, t: (key: string) => string): string {
  if (!prefill) return "";
  const dayLabel = t(`profile.grid_day_${prefill.day}`);
  return `${dayLabel} ${hourLabel(prefill.hour)}–${hourLabel(prefill.hour + 1)}`;
}
