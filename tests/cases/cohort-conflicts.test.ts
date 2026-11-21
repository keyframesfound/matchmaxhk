import { describe, expect, it } from "vitest";

import { cohortSessionConflicts } from "../../src/features/cases/cohort-conflicts";
import {
  emptyHourlyOpenHours,
  type HourlyOpenHours,
} from "../../src/features/tutors/availability-grid-model";

/** A grid with hours claimed on one HKT weekday only. */
function sessions(day: keyof HourlyOpenHours, hours: number[]): HourlyOpenHours {
  const grid = emptyHourlyOpenHours();
  grid[day] = hours;
  return grid;
}

describe("cohortSessionConflicts (#768)", () => {
  // 2026-11-23 is a Monday in HKT. A full cohort claims its 17:00 cell.
  const cohort = sessions("mon", [17]);

  it("a 17:00 cohort cell blocks a 60-minute lesson starting 17:30", () => {
    expect(cohortSessionConflicts(new Date("2026-11-23T17:30:00+08:00"), 60, cohort)).toBe(true);
  });

  it("does not block a lesson starting 18:30", () => {
    expect(cohortSessionConflicts(new Date("2026-11-23T18:30:00+08:00"), 60, cohort)).toBe(false);
  });

  it("blocks an exact 17:00–18:00 lesson", () => {
    expect(cohortSessionConflicts(new Date("2026-11-23T17:00:00+08:00"), 60, cohort)).toBe(true);
  });

  it("still conflicts for an online candidate (cohort is time, not mode)", () => {
    // The guard takes no mode: an online lesson still occupies the tutor's hour.
    expect(cohortSessionConflicts(new Date("2026-11-23T17:30:00+08:00"), 60, cohort)).toBe(true);
  });

  it("an empty session grid never conflicts", () => {
    expect(
      cohortSessionConflicts(new Date("2026-11-23T17:30:00+08:00"), 60, emptyHourlyOpenHours()),
    ).toBe(false);
  });

  it("a lesson crossing midnight sees the Sunday 23:00 cell", () => {
    // 2026-11-29 is a Sunday; 23:30 + 60min ends Monday 00:30 HKT.
    expect(
      cohortSessionConflicts(new Date("2026-11-29T23:30:00+08:00"), 60, sessions("sun", [23])),
    ).toBe(true);
  });
});
