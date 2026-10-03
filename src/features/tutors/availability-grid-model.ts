import type { TFunction } from "i18next";

/**
 * Issue #116: weekly availability grid model, shared by the public-profile
 * display and the tutor's self-serve editor in Dashboard → Availability.
 *
 * 7 day columns (mon..sun) × 6 fixed 3-hour slot rows. Each cell is one of
 * three states stored as a single character code:
 *   "a" — available (可補)
 *   "p" — partial (部分時段可)
 *   "u" — unavailable (不可補)
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

/** An empty grid — every cell unavailable. */
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

/** True when every cell is "u" — the grid carries no information. */
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
 * rows are AM, noon onwards PM — matches how HK parents read a timetable.
 */
export function gridSlotLabel(slot: GridSlot, t: TFunction): string {
  const isAm = slot === "06-09" || slot === "09-12";
  return `${isAm ? t("profile.grid_slot_am") : t("profile.grid_slot_pm")} ${GRID_SLOT_RANGES[slot]}`;
}

/** Count of non-unavailable cells — drives the "has any availability" checks. */
export function countAvailableCells(grid: Record<GridDay, GridCellState[]>): number {
  return GRID_DAYS.reduce(
    (total, day) => total + grid[day].filter((state) => state !== "u").length,
    0,
  );
}
