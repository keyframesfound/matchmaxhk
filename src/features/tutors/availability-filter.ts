import {
  GRID_DAYS,
  parseAvailabilityGrid,
  isGridEmpty,
  type GridDay,
} from "./availability-grid-model";

/**
 * #605 §3.11: Explore Availability filter (More Filters only).
 *
 * Parents pick weekdays and coarse time bands. Tutors are matched against
 * the same soft weekly grid they keep in Dashboard → Availability (#551 /
 * #116 `tutors.availability_grid`), never a second calendar. Prefs are soft:
 *   - grid has a free ("a") or partial ("p") cell in a picked day × band → match
 *   - grid empty / never set → still shown, ranked last (CEO default)
 *   - grid set but no overlap → filtered out
 * Picking only days means "any time that day"; only bands means "that band
 * on any day".
 */

export const AVAIL_BANDS = ["morning", "afternoon", "evening"] as const;
export type AvailBand = (typeof AVAIL_BANDS)[number];

/** Grid slot row indexes (06-09 … 21-24) covered by each band. */
export const BAND_ROWS: Record<AvailBand, number[]> = {
  morning: [0, 1],
  afternoon: [2, 3],
  evening: [4, 5],
};

export type AvailabilityPick = { days: GridDay[]; bands: AvailBand[] };

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

/** URL value for a pick list, undefined when empty (keeps URLs clean). */
export function joinAvailParam(values: readonly string[]): string | undefined {
  return values.length > 0 ? values.join(",") : undefined;
}

export function isAvailabilityActive(pick: AvailabilityPick): boolean {
  return pick.days.length > 0 || pick.bands.length > 0;
}

export type AvailabilityMatch = "match" | "unset" | "miss";

export function matchTutorAvailability(
  rawGrid: unknown,
  pick: AvailabilityPick,
): AvailabilityMatch {
  if (!isAvailabilityActive(pick)) return "match";
  const grid = parseAvailabilityGrid(rawGrid);
  if (isGridEmpty(grid)) return "unset";
  const days = pick.days.length > 0 ? pick.days : GRID_DAYS;
  const rows =
    pick.bands.length > 0 ? pick.bands.flatMap((band) => BAND_ROWS[band]) : [0, 1, 2, 3, 4, 5];
  const overlap = days.some((day) => rows.some((row) => grid[day][row] !== "u"));
  return overlap ? "match" : "miss";
}

/** Sort rank: explicit overlap first, unset grids last. */
export function availabilityRank(match: AvailabilityMatch): number {
  return match === "match" ? 0 : 1;
}
