import {
  GRID_DAYS,
  parseAvailabilityGrid,
  isGridEmpty,
  type GridDay,
} from "./availability-grid-model";

/**
 * #605 §3.11 / #771 §2.2: Explore Availability filter (More Filters only).
 *
 * Parents pick a schedule mode plus weekdays, coarse time bands and an
 * optional HKT date range. Tutors are matched against the same soft weekly
 * grid they keep in Dashboard → Availability (#551 / #116
 * `tutors.availability_grid`), never a second calendar. Prefs are soft:
 *   - grid has a free ("a") or partial ("p") cell in a picked day × band → match
 *   - grid empty / never set → still shown, ranked last (CEO default). An
 *     empty grid is also the only "flexible / no fixed slots" signal a tutor
 *     profile carries today, so those tutors must stay findable under any
 *     slot filter (ranked below explicit overlap)
 *   - grid set but no overlap → filtered out
 *   - date range → expanded to the weekdays it covers, then intersected with
 *     the picked days; a range that cannot intersect is ignored (soft, never
 *     hides tutors)
 * Picking only days means "any time that day"; only bands means "that band
 * on any day". Schedule mode `flexible` means the PARENT has no fixed slots,
 * so availability stops narrowing at all. Availability is a query pref, never
 * a booking: it must never hard-block search or a Case Request submit.
 */

export const AVAIL_BANDS = ["morning", "afternoon", "evening"] as const;
export type AvailBand = (typeof AVAIL_BANDS)[number];

/** Parent-side schedule mode (locked labels live in explore_search.avail_mode_*). */
export const AVAIL_MODES = ["specific", "flexible"] as const;
export type AvailMode = (typeof AVAIL_MODES)[number];

/** Grid slot row indexes (06-09 … 21-24) covered by each band. */
export const BAND_ROWS: Record<AvailBand, number[]> = {
  morning: [0, 1],
  afternoon: [2, 3],
  evening: [4, 5],
};

/** Longest date range we expand into weekdays (a year); longer = ignored. */
export const MAX_DATE_RANGE_DAYS = 366;

export type AvailabilityPick = {
  days: GridDay[];
  bands: AvailBand[];
  /** Parent schedule mode; absent / "any" keeps the default slot narrowing. */
  mode?: AvailMode;
  /** Optional HKT range, "YYYY-MM-DD". Both ends or none. */
  dateFrom?: string;
  dateTo?: string;
};

/** Parse a comma / "||"-joined URL param into the known values (order kept). */
function parseList<T extends string>(raw: unknown, allowed: readonly T[]): T[] {
  if (typeof raw !== "string") return [];
  const seen = new Set<T>();
  for (const part of raw.split(/,|\|\|/)) {
    const value = part.trim().toLowerCase() as T;
    if (allowed.includes(value)) seen.add(value);
  }
  return allowed.filter((value) => seen.has(value));
}

export function parseAvailDays(raw: unknown): GridDay[] {
  return parseList(raw, GRID_DAYS);
}

export function parseAvailBands(raw: unknown): AvailBand[] {
  return parseList(raw, AVAIL_BANDS);
}

/** Schedule mode from a URL value; "any" and junk both mean "no mode". */
export function parseAvailMode(raw: unknown): AvailMode | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim().toLowerCase();
  return (AVAIL_MODES as readonly string[]).includes(value) ? (value as AvailMode) : undefined;
}

/** Strict "YYYY-MM-DD" parser; junk (and impossible dates) drop to undefined. */
export function parseAvailDate(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  // Rejects rollovers such as 2026-02-31.
  return parsed.toISOString().slice(0, 10) === value ? value : undefined;
}

/** URL value for a pick list, undefined when empty (keeps URLs clean). */
export function joinAvailParam(values: readonly string[]): string | undefined {
  return values.length > 0 ? values.join(",") : undefined;
}

/**
 * Weekdays covered by a date range (inclusive). HKT is a fixed UTC+8 offset
 * with no DST, so the calendar date the parent typed is also the HKT date.
 * An absent / inverted / over-long range yields [] = "ignore the dates".
 */
export function dateRangeWeekdays(from?: string, to?: string): GridDay[] {
  const start = parseAvailDate(from);
  const end = parseAvailDate(to);
  if (!start || !end) return [];
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (endMs < startMs) return [];
  const dayCount = Math.round((endMs - startMs) / 86_400_000) + 1;
  if (dayCount > MAX_DATE_RANGE_DAYS) return [];
  const covered = new Set<GridDay>();
  for (let i = 0; i < dayCount; i++) {
    const day = new Date(startMs + i * 86_400_000).getUTCDay();
    covered.add(GRID_DAYS[(day + 6) % 7]);
  }
  return GRID_DAYS.filter((day) => covered.has(day));
}

/** True when the pick would narrow results (mode `flexible` never narrows). */
export function isAvailabilityActive(pick: AvailabilityPick): boolean {
  if (pick.mode === "flexible") return false;
  return (
    pick.days.length > 0 ||
    pick.bands.length > 0 ||
    dateRangeWeekdays(pick.dateFrom, pick.dateTo).length > 0
  );
}

export type AvailabilityMatch = "match" | "unset" | "miss";

/**
 * Tutor profiles carry no separate "flexible" column: a grid with no free or
 * partial cell (never set, or every cell unavailable) is the flexible / no
 * fixed slots state. Those tutors always stay findable, ranked last.
 */
export function isFlexibleSchedule(rawGrid: unknown): boolean {
  return isGridEmpty(parseAvailabilityGrid(rawGrid));
}

export function matchTutorAvailability(
  rawGrid: unknown,
  pick: AvailabilityPick,
): AvailabilityMatch {
  if (!isAvailabilityActive(pick)) return "match";
  const grid = parseAvailabilityGrid(rawGrid);
  if (isGridEmpty(grid)) return "unset";
  let days: readonly GridDay[] = pick.days.length > 0 ? pick.days : GRID_DAYS;
  const rangeDays = dateRangeWeekdays(pick.dateFrom, pick.dateTo);
  if (rangeDays.length > 0) days = days.filter((day) => rangeDays.includes(day));
  // A day pick and a range that never meet is a soft preference, not a hide.
  if (days.length === 0) return "unset";
  const rows =
    pick.bands.length > 0 ? pick.bands.flatMap((band) => BAND_ROWS[band]) : [0, 1, 2, 3, 4, 5];
  const overlap = days.some((day) => rows.some((row) => grid[day][row] !== "u"));
  return overlap ? "match" : "miss";
}

/** Sort rank: explicit overlap first, flexible / unset grids last. */
export function availabilityRank(match: AvailabilityMatch): number {
  return match === "match" ? 0 : 1;
}

/**
 * #605 §3.11 Cases scope: match a case's parent-preferred times (#656
 * intake) against the browsing tutor's picks. Flexible cases match any
 * pick; specific cases need ≥1 overlapping slot; cases from before the
 * intake restore (no mode) are "unset" (shown, ranked last).
 */
export function matchCaseAvailability(
  scheduleMode: string | null | undefined,
  scheduleSlots: readonly { day: string; period: string }[] | null | undefined,
  pick: AvailabilityPick,
): AvailabilityMatch {
  if (!isAvailabilityActive(pick)) return "match";
  if (scheduleMode === "flexible") return "match";
  const slots = Array.isArray(scheduleSlots) ? scheduleSlots : [];
  if (scheduleMode !== "specific" || slots.length === 0) return "unset";
  const rangeDays = dateRangeWeekdays(pick.dateFrom, pick.dateTo);
  const overlap = slots.some(
    (slot) =>
      (pick.days.length === 0 || pick.days.includes(slot.day as GridDay)) &&
      (pick.bands.length === 0 || pick.bands.includes(slot.period as AvailBand)) &&
      (rangeDays.length === 0 || rangeDays.includes(slot.day as GridDay)),
  );
  return overlap ? "match" : "miss";
}
