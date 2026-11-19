import { describe, expect, it } from "vitest";

import { GRID_DAYS } from "../../src/features/tutors/availability-grid-model";
import {
  countOpenHours,
  emptyHourlyGrid,
  isHourlyEmpty,
  legacySlotHours,
  mergeOccupied,
  parseHourlyGrid,
  projectLegacyGrid,
  type HourlyDay,
  type HourlyGrid,
} from "../../src/features/tutors/availability-hours-model";

/**
 * Issue #768 Part 1: 7 days × 24 hourly cells replacing the coarse 7×6
 * three-hour grid at the data level. The public teaching window is a later UI
 * concern, so every function here keeps all 24 hours.
 */

function expectFullClosedGrid(grid: HourlyGrid) {
  for (const day of GRID_DAYS) {
    expect(grid[day]).toHaveLength(24);
    expect(grid[day].every((cell) => cell === false)).toBe(true);
  }
}

function baseWith(open: Array<[HourlyDay, number]>): HourlyGrid {
  const grid = emptyHourlyGrid();
  for (const [day, hour] of open) grid[day][hour] = true;
  return grid;
}

function legacyAll(code: "a" | "p" | "u", overrides: Array<[HourlyDay, number, string]> = []) {
  const grid: Record<string, string[]> = Object.fromEntries(
    GRID_DAYS.map((day) => [day, Array<string>(6).fill(code)]),
  );
  for (const [day, slot, override] of overrides) grid[day][slot] = override;
  return grid;
}

describe("parseHourlyGrid", () => {
  it("returns a full 7×24 grid of false for non-object input", () => {
    expectFullClosedGrid(parseHourlyGrid(null));
    expectFullClosedGrid(parseHourlyGrid(undefined));
    expectFullClosedGrid(parseHourlyGrid({}));
    expectFullClosedGrid(parseHourlyGrid([]));
    expectFullClosedGrid(parseHourlyGrid("not a grid"));
    expectFullClosedGrid(parseHourlyGrid(42));
  });

  it("pads a truncated day with false, keeping valid cells", () => {
    const grid = parseHourlyGrid({ mon: [true, true] });

    expect(grid.mon).toHaveLength(24);
    expect(grid.mon[0]).toBe(true);
    expect(grid.mon[1]).toBe(true);
    expect(grid.mon[2]).toBe(false);
    expect(grid.mon[23]).toBe(false);
    for (const day of GRID_DAYS) {
      if (day === "mon") continue;
      expect(grid[day].every((cell) => cell === false)).toBe(true);
    }
  });

  it("accepts true/false and 1/0 cell values", () => {
    const grid = parseHourlyGrid({
      mon: [true, false, 1, 0, "true", null, {}, [], ...Array<boolean>(17).fill(false)],
    });
    expect(grid.mon).toHaveLength(24);
    expect(grid.mon[0]).toBe(true);
    expect(grid.mon[1]).toBe(false);
    expect(grid.mon[2]).toBe(true);
    expect(grid.mon[3]).toBe(false);
    expect(grid.mon[4]).toBe(false);
    expect(grid.mon[5]).toBe(false);
    expect(grid.mon[6]).toBe(false);
    expect(grid.mon[7]).toBe(false);
    expect(grid.sun.every((cell) => cell === false)).toBe(true);
  });

  it("ignores unknown days and extra cells", () => {
    const grid = parseHourlyGrid({
      funday: Array<boolean>(24).fill(true),
      mon: Array<boolean>(30).fill(true),
    });
    expect(grid.mon).toHaveLength(24);
    expect(grid.mon.every((cell) => cell === true)).toBe(true);
    expect(grid.sat.every((cell) => cell === false)).toBe(true);
  });
});

describe("projectLegacyGrid", () => {
  it("opens the three hours under an available slot and nothing else", () => {
    const grid = projectLegacyGrid(legacyAll("u", [["mon", 0, "a"]]));

    expect(grid.mon[6]).toBe(true);
    expect(grid.mon[7]).toBe(true);
    expect(grid.mon[8]).toBe(true);
    expect(grid.mon[9]).toBe(false);

    for (const day of GRID_DAYS) {
      for (let hour = 0; hour < 24; hour++) {
        const expected = day === "mon" && hour >= 6 && hour <= 8;
        expect(grid[day][hour]).toBe(expected);
      }
    }
  });

  it("maps unavailable to all false", () => {
    expectFullClosedGrid(projectLegacyGrid(legacyAll("u")));
  });

  it("keeps partial closed because hours inside a Partial block are unknown", () => {
    expectFullClosedGrid(projectLegacyGrid(legacyAll("p")));
    expectFullClosedGrid(projectLegacyGrid(legacyAll("p", [["tue", 3, "p"]])));
  });

  it("keeps an all-partial legacy grid empty, protecting profile.grid_empty", () => {
    expect(isHourlyEmpty(projectLegacyGrid(legacyAll("p")))).toBe(true);
  });

  it("collapses unknown codes and short data to false", () => {
    expectFullClosedGrid(projectLegacyGrid(null));
    expectFullClosedGrid(projectLegacyGrid({ bogus: ["a"] }));

    const grid = projectLegacyGrid({ mon: ["z", "a", 1, true] });
    expect(grid.mon[6]).toBe(false);
    expect(grid.mon[9]).toBe(true);
    expect(grid.mon[10]).toBe(true);
    expect(grid.mon[11]).toBe(true);
    expect(grid.mon[12]).toBe(false);
    for (const day of GRID_DAYS) {
      if (day === "mon") continue;
      expect(grid[day].every((cell) => cell === false)).toBe(true);
    }
  });
});

describe("legacySlotHours", () => {
  it("maps slot 0 to hours 6..8", () => {
    expect(legacySlotHours(0)).toEqual([6, 7, 8]);
  });

  it("maps slot 5 to hours 21..23", () => {
    expect(legacySlotHours(5)).toEqual([21, 22, 23]);
  });
});

describe("mergeOccupied", () => {
  it("lets occupied win over open and over closed", () => {
    const base = baseWith([["mon", 10]]);
    const states = mergeOccupied(base, [
      { day: "mon", hour: 10 },
      { day: "mon", hour: 11 },
    ]);

    expect(states.mon[10]).toBe("occupied");
    expect(states.mon[11]).toBe("occupied");
  });

  it("leaves untouched cells in their base state", () => {
    const base = baseWith([["mon", 10]]);
    const states = mergeOccupied(base, [{ day: "tue", hour: 9 }]);

    expect(states.mon[10]).toBe("open");
    expect(states.mon[11]).toBe("closed");
    expect(states.tue[9]).toBe("occupied");
    expect(states.tue[10]).toBe("closed");
  });

  it("does not mutate the base grid", () => {
    const base = baseWith([["mon", 10]]);
    mergeOccupied(base, [{ day: "mon", hour: 10 }]);

    expect(base.mon[10]).toBe(true);
    expect(base.mon[11]).toBe(false);
  });

  it("ignores out-of-range hours and duplicates without throwing", () => {
    const base = baseWith([["mon", 10]]);
    const states = mergeOccupied(base, [
      { day: "mon", hour: 24 },
      { day: "mon", hour: -1 },
      { day: "mon", hour: 10 },
      { day: "mon", hour: 10 },
    ]);

    expect(states.mon[10]).toBe("occupied");
    expect(states.mon[0]).toBe("closed");
    expect(states.mon[23]).toBe("closed");
  });
});

describe("countOpenHours", () => {
  it("counts open cells but not occupied or closed cells", () => {
    const base = baseWith([
      ["mon", 10],
      ["mon", 11],
      ["tue", 9],
    ]);
    const states = mergeOccupied(base, [
      { day: "mon", hour: 10 },
      { day: "tue", hour: 9 },
    ]);

    expect(countOpenHours(states)).toBe(1);
  });

  it("is zero for an empty grid", () => {
    expect(countOpenHours(mergeOccupied(emptyHourlyGrid(), []))).toBe(0);
  });
});

describe("isHourlyEmpty", () => {
  it("is false when at least one cell is open", () => {
    expect(isHourlyEmpty(baseWith([["sun", 23]]))).toBe(false);
  });

  it("is true for an empty grid", () => {
    expect(isHourlyEmpty(emptyHourlyGrid())).toBe(true);
  });
});
