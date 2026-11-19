import { GRID_DAYS, type GridDay } from "./availability-grid-model";

/**
 * Issue #768 Part 1: hourly availability model.
 *
 * Replaces the coarse 7×6 three-hour grid (issue #116) at the data level with
 * 7 days × 24 hourly cells. Hour indices are HKT local hours (0..23); the
 * teaching window is a rendering concern, so this model keeps every hour.
 *
 * Only two public states exist per cell: open or occupied. Anything not open
 * on the tutor's base grid is closed. Occupied beats closed: a confirmed
 * lesson on a base-closed hour is still a real commitment.
 */

export type HourlyDay = GridDay;

/** 24 hourly cells, true = Open (tutor's base availability), false = not open. */
export type HourlyGrid = Record<HourlyDay, boolean[]>;

/** Public state of one cell. Only two public states exist. */
export type HourCellState = "open" | "occupied" | "closed";

/** An empty hourly grid, every hour not open. */
export function emptyHourlyGrid(): HourlyGrid {
  return Object.fromEntries(
    GRID_DAYS.map((day) => [day, Array<boolean>(24).fill(false)]),
  ) as HourlyGrid;
}

/**
 * Parse untrusted JSONB into a full 7×24 matrix of booleans. Non-object input,
 * unknown days, short/long rows and non-boolean cells all collapse to false
 * rather than throwing, so legacy or half-written data always renders.
 *
 * Accepts both true/false and 1/0 because the column is JSONB.
 */
export function parseHourlyGrid(raw: unknown): HourlyGrid {
  const grid = emptyHourlyGrid();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return grid;
  const source = raw as Record<string, unknown>;
  for (const day of GRID_DAYS) {
    const cells = source[day];
    if (!Array.isArray(cells)) continue;
    for (let hour = 0; hour < 24; hour++) {
      const cell = cells[hour];
      grid[day][hour] = cell === true || cell === 1;
    }
  }
  return grid;
}

/**
 * Slot index (0..5) of the legacy 3-hour grid -> its three hour indices
 * (6..23). Legacy rows are 06-09, 09-12, 12-15, 15-18, 18-21, 21-24, so slot
 * 5 ends at hour 23.
 */
export function legacySlotHours(slotIndex: number): [number, number, number] {
  const start = 6 + slotIndex * 3;
  return [start, start + 1, start + 2];
}

/**
 * Project the legacy 7×6 code grid into hourly cells: "a" opens its three
 * hours; "u" and "p" stay closed. Partial deliberately becomes NOT open — the
 * ticket forbids inventing hours inside a Partial block. Unknown or short data
 * reads as closed.
 */
export function projectLegacyGrid(legacy: unknown): HourlyGrid {
  const grid = emptyHourlyGrid();
  if (!legacy || typeof legacy !== "object") return grid;
  const source = legacy as Record<string, unknown>;
  for (const day of GRID_DAYS) {
    const cells = source[day];
    if (!Array.isArray(cells)) continue;
    for (let slotIndex = 0; slotIndex < 6; slotIndex++) {
      if (cells[slotIndex] !== "a") continue;
      for (const hour of legacySlotHours(slotIndex)) grid[day][hour] = true;
    }
  }
  return grid;
}

/** True when at least one hour index is a real integer inside 0..23. */
function isValidHour(hour: unknown): hour is number {
  return typeof hour === "number" && Number.isInteger(hour) && hour >= 0 && hour <= 23;
}

/**
 * Overlay confirmed lessons on the base grid. Closed base cells stay closed,
 * open base cells stay open, and every valid occupied entry wins over both.
 * Out-of-range hours, unknown days and duplicates are ignored, never thrown.
 */
export function mergeOccupied(
  base: HourlyGrid,
  occupied: ReadonlyArray<{ day: HourlyDay; hour: number }>,
): Record<HourlyDay, HourCellState[]> {
  const states = Object.fromEntries(
    GRID_DAYS.map((day) => [
      day,
      Array<HourCellState>(24)
        .fill("closed")
        .map((_, hour) => (base[day][hour] ? "open" : "closed")),
    ]),
  ) as Record<HourlyDay, HourCellState[]>;

  for (const entry of occupied) {
    if (!entry || !GRID_DAYS.includes(entry.day)) continue;
    if (!isValidHour(entry.hour)) continue;
    states[entry.day][entry.hour] = "occupied";
  }

  return states;
}

/** Count of cells that are still open; occupied hours are commitments, not openings. */
export function countOpenHours(states: Record<HourlyDay, HourCellState[]>): number {
  return GRID_DAYS.reduce(
    (total, day) => total + states[day].filter((state) => state === "open").length,
    0,
  );
}

/** True when no cell is open, the grid carries no availability. */
export function isHourlyEmpty(grid: HourlyGrid): boolean {
  return GRID_DAYS.every((day) => grid[day].every((cell) => cell !== true));
}
