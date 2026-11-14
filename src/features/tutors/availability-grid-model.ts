import type { TFunction } from "i18next";

/**
 * Issue #116: weekly availability grid model, shared by the public-profile
 * display and the tutor's self-serve editor in Dashboard → Availability.
 *
 * 7 day columns (mon..sun) × 6 fixed 3-hour slot rows. Each cell is one of
 * three states stored as a single character code:
 *   "a", available (可補)
 *   "p", partial (部分時段可)
 *   "u", unavailable (不可補)
 *
 * Stored on tutors.availability_grid (JSONB, see migration
 * 20261001200000_add_availability_grid.sql). Missing/short days read as all
 * unavailable, so partially-written data renders safely.
 */

export const GRID_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type GridDay = (typeof GRID_DAYS)[number];

export const GRID_SLOTS = ["06-09", "09-12", "12-15", "15-18", "18-21", "21-24"] as const;
export type GridSlot = (typeof GRID_SLOTS)[number];

export type GridCellState = "a" | "p" | "u";

/** An empty grid, every cell unavailable. */
export function emptyAvailabilityGrid(): Record<GridDay, GridCellState[]> {
  return Object.fromEntries(
    GRID_DAYS.map((day) => [day, Array<GridCellState>(6).fill("u")]),
  ) as Record<GridDay, GridCellState[]>;
}

/**
 * Parse untrusted JSONB into a full 7×6 matrix. Unknown codes, short rows and
 * non-array days collapse to "unavailable" rather than throwing, so legacy or
 * half-written data always renders.
 */
export function parseAvailabilityGrid(raw: unknown): Record<GridDay, GridCellState[]> {
  const grid = emptyAvailabilityGrid();
  if (!raw || typeof raw !== "object") return grid;
  const source = raw as Record<string, unknown>;
  for (const day of GRID_DAYS) {
    const cells = source[day];
    if (!Array.isArray(cells)) continue;
    for (let i = 0; i < 6; i++) {
      const code = cells[i];
      if (code === "a" || code === "p" || code === "u") grid[day][i] = code;
    }
  }
  return grid;
}

/** True when every cell is "u", the grid carries no information. */
export function isGridEmpty(grid: Record<GridDay, GridCellState[]>): boolean {
  return GRID_DAYS.every((day) => grid[day].every((state) => state === "u"));
}

/** 24h range for each slot row, used for tooltips and the editor. */
export const GRID_SLOT_RANGES: Record<GridSlot, string> = {
  "06-09": "06:00 – 09:00",
  "09-12": "09:00 – 12:00",
  "12-15": "12:00 – 15:00",
  "15-18": "15:00 – 18:00",
  "18-21": "18:00 – 21:00",
  "21-24": "21:00 – 24:00",
};

/**
 * AM/PM row label (per Ryan: AM/PM instead of "first/second half"). Morning
 * rows are AM, noon onwards PM, matches how HK parents read a timetable.
 */
export function gridSlotLabel(slot: GridSlot, t: TFunction): string {
  const isAm = slot === "06-09" || slot === "09-12";
  return `${isAm ? t("profile.grid_slot_am") : t("profile.grid_slot_pm")} ${GRID_SLOT_RANGES[slot]}`;
}

/** Count of non-unavailable cells, drives the "has any availability" checks. */
export function countAvailableCells(grid: Record<GridDay, GridCellState[]>): number {
  return GRID_DAYS.reduce(
    (total, day) => total + grid[day].filter((state) => state !== "u").length,
    0,
  );
}

// ---------------------------------------------------------------------------
// Issue #768: weekly HOURLY availability (Open / Occupied only, HKT / UTC+8).
//
// The public grid is the hourly SoT: 7 day columns × hourly rows 06:00–24:00,
// stored on tutors.availability_grid_hourly as the sorted array of Open START
// hours per day. Only two public states exist — Open (可約) and Occupied
// (已佔用); Occupied is derived at READ time from confirmed lessons (case
// lessons + roster sessions) and is never stored. The 3-hour model above stays
// as the fallback read until cutover: a tutor whose hourly column is still
// unset (e.g. joined via the 3-hour join form) falls back to their legacy
// 'a' cells through mapLegacyGridToHourly — the same rule as the migration's
// one-time auto-map ('a' → all three hourly cells in the block Open; 'p' and
// 'u' never invent hours).
// ---------------------------------------------------------------------------

/** First hourly row (HKT), matches the legacy grid's 06:00 start. */
export const HOURLY_GRID_START_HOUR = 6;
/** Exclusive end (HKT midnight), matches the legacy grid's 24:00 end. */
export const HOURLY_GRID_END_HOUR = 24;
/** Hourly rows 06:00–23:00, each cell covering hour:00 → (hour+1):00. */
export const HOURLY_GRID_HOURS = HOURLY_GRID_END_HOUR - HOURLY_GRID_START_HOUR;

export type HourlyOpenHours = Record<GridDay, number[]>;

/** An empty hourly grid, no Open hours on any day. */
export function emptyHourlyOpenHours(): HourlyOpenHours {
  return Object.fromEntries(GRID_DAYS.map((day) => [day, [] as number[]])) as HourlyOpenHours;
}

function cleanHourList(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  for (const value of raw) {
    const hour = typeof value === "number" ? Math.round(value) : Number(value);
    if (Number.isInteger(hour) && hour >= HOURLY_GRID_START_HOUR && hour < HOURLY_GRID_END_HOUR) {
      seen.add(hour);
    }
  }
  return [...seen].sort((a, b) => a - b);
}

/**
 * Parse untrusted JSONB into the hourly matrix. Unknown day keys are ignored,
 * out-of-range / non-integer hours are dropped and each day is sorted+deduped,
 * so legacy or half-written data always renders.
 */
export function parseHourlyOpenHours(raw: unknown): HourlyOpenHours {
  const grid = emptyHourlyOpenHours();
  if (!raw || typeof raw !== "object") return grid;
  const source = raw as Record<string, unknown>;
  for (const day of GRID_DAYS) grid[day] = cleanHourList(source[day]);
  return grid;
}

/**
 * One-time auto-map of the 3-hour cells to hourly Open hours (CEO lock
 * 2026-11-13, same rule as the migration backfill): 'a' opens all three
 * hourly cells in that 3-hour block; 'p' (Partial) and 'u' stay closed —
 * Partial hours are never invented and Partial is not a public third state.
 */
export function mapLegacyGridToHourly(raw: unknown): HourlyOpenHours {
  const legacy = parseAvailabilityGrid(raw);
  const grid = emptyHourlyOpenHours();
  for (const day of GRID_DAYS) {
    const hours: number[] = [];
    legacy[day].forEach((state, slotIndex) => {
      if (state === "a") {
        for (let h = 0; h < 3; h++) hours.push(HOURLY_GRID_START_HOUR + 3 * slotIndex + h);
      }
    });
    grid[day] = hours.sort((a, b) => a - b);
  }
  return grid;
}

/** True when no day has any Open hour. */
export function isHourlyGridEmpty(open: HourlyOpenHours): boolean {
  return GRID_DAYS.every((day) => open[day].length === 0);
}

/**
 * Occupied overrides (derived at read time from confirmed lessons) clipped to
 * the tutor's base Open hours: an Occupied cell is always an Open cell with a
 * confirmed booking, so editing base hours never erases confirmed cells and a
 * cancellation naturally restores the Open slot.
 */
export function clipOccupiedToOpen(
  open: HourlyOpenHours,
  occupied: HourlyOpenHours,
): HourlyOpenHours {
  const clipped = emptyHourlyOpenHours();
  for (const day of GRID_DAYS) {
    const openSet = new Set(open[day]);
    clipped[day] = occupied[day].filter((hour) => openSet.has(hour));
  }
  return clipped;
}

/** "17:00" row label for an hourly start hour. */
export function hourlyHourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/** "17:00 – 18:00" cell range label (HKT), used for tooltips/aria. */
export function hourlyRangeLabel(hour: number): string {
  return `${hourlyHourLabel(hour)} – ${hourlyHourLabel(hour + 1)}`;
}
