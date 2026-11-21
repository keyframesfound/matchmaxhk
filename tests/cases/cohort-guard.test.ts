import { describe, expect, it } from "vitest";

import { partitionSeriesClashes } from "../../src/features/cases/case-schedule";
import { rescheduleLessonError } from "../../src/features/cases/case-billing";
import { scheduleLessonError } from "../../src/features/cases/schedule-lesson";
import { generateSlots } from "../../src/features/cases/slot";
import { hktFromParts } from "../../src/features/cases/sor";
import {
  emptyHourlyOpenHours,
  type HourlyOpenHours,
} from "../../src/features/tutors/availability-grid-model";

/**
 * Issue #768 wiring: every scheduling guard consults the tutor's FULL cohort
 * hours, so a 1-on-1 cannot be booked over a class. With no cohorts in
 * production the extra input is undefined and each guard behaves exactly as
 * before — that neutrality is asserted here too.
 */

/** A grid claiming hours on one HKT weekday only. */
function sessions(day: keyof HourlyOpenHours, hours: number[]): HourlyOpenHours {
  const grid = emptyHourlyOpenHours();
  grid[day] = hours;
  return grid;
}

// Tutor window: Mon 16:00–20:00 HKT. 2026-11-23 is a Monday in HKT.
const MON = { weekday: 0, startMinute: 16 * 60, endMinute: 20 * 60, station: "Admiralty" };
const MONDAY = hktFromParts("2026-11-23", 12 * 60);
const NOW = MONDAY;

const COHORT_17 = sessions("mon", [17]);

describe("generateSlots with full cohort hours (#768)", () => {
  const hoursOn = (cohortSessions?: HourlyOpenHours) =>
    generateSlots([MON], [], [], MONDAY, NOW, { horizonDays: 0, cohortSessions })
      .filter((s) => s.startsAt.toISOString().startsWith("2026-11-23"))
      .map((s) => s.startsAt.toISOString().slice(11, 16));

  it("skips the slot that collides with a cohort cell and keeps the others", () => {
    // 17:00 HKT == 09:00Z.
    expect(hoursOn(COHORT_17)).toEqual(["08:00", "10:00", "11:00"]);
  });

  it("behaves exactly as before when the grid is undefined or empty", () => {
    const baseline = ["08:00", "09:00", "10:00", "11:00"];
    expect(hoursOn(undefined)).toEqual(baseline);
    expect(hoursOn(emptyHourlyOpenHours())).toEqual(baseline);
  });
});

describe("partitionSeriesClashes with full cohort hours (#768)", () => {
  // Tue 17:00 HKT and Tue 24 Nov 17:00 HKT, one week apart.
  const starts = ["2026-11-24T09:00:00.000Z", "2026-12-01T09:00:00.000Z"];

  it("marks a start inside a cohort cell as a clash", () => {
    const cohort = sessions("tue", [17]);
    const { free, clashes } = partitionSeriesClashes(starts, 60, true, [], cohort);
    expect(free).toEqual([]);
    expect(clashes).toEqual(starts);
  });

  it("keeps a start outside every cohort cell free", () => {
    const cohort = sessions("tue", [18]);
    const { free, clashes } = partitionSeriesClashes(starts, 60, true, [], cohort);
    expect(free).toEqual(starts);
    expect(clashes).toEqual([]);
  });

  it("behaves exactly as before when the grid is undefined or empty", () => {
    expect(partitionSeriesClashes(starts, 60, true, [])).toEqual({
      free: starts,
      clashes: [],
    });
    expect(partitionSeriesClashes(starts, 60, true, [], emptyHourlyOpenHours())).toEqual({
      free: starts,
      clashes: [],
    });
  });
});

describe("scheduleLessonError with full cohort hours (#768)", () => {
  const base = {
    sorStatus: "active",
    startsAtIso: "2026-11-24T09:00:00.000Z", // Tue 17:00 HKT
    durationMin: 60,
    online: false,
    now: new Date("2026-11-20T04:00:00Z"),
    existing: [] as { starts_at: string; duration_min: number; mode?: string | null }[],
  };

  it("returns the conflict reason for a cohort collision", () => {
    expect(scheduleLessonError({ ...base, cohortSessions: sessions("tue", [17]) })).toBe(
      "SLOT_CONFLICT",
    );
  });

  it("conflicts even for an online lesson (cohort is time, not mode)", () => {
    expect(
      scheduleLessonError({ ...base, online: true, cohortSessions: sessions("tue", [17]) }),
    ).toBe("SLOT_CONFLICT");
  });

  it("behaves exactly as before when the grid is undefined or empty", () => {
    expect(scheduleLessonError(base)).toBeNull();
    expect(scheduleLessonError({ ...base, cohortSessions: emptyHourlyOpenHours() })).toBeNull();
  });
});

describe("rescheduleLessonError with full cohort hours (#768)", () => {
  const base = {
    lesson: { startsAt: "2026-11-22T09:00:00.000Z", status: "confirmed" },
    proposedIso: "2026-11-24T09:00:00.000Z", // Tue 17:00 HKT
    now: new Date("2026-11-20T04:00:00Z"),
  };

  it("returns the conflict reason for a cohort collision", () => {
    expect(rescheduleLessonError({ ...base, cohortSessions: sessions("tue", [17]) })).toBe(
      "SLOT_CONFLICT",
    );
  });

  it("behaves exactly as before when the grid is undefined or empty", () => {
    expect(rescheduleLessonError(base)).toBeNull();
    expect(rescheduleLessonError({ ...base, cohortSessions: emptyHourlyOpenHours() })).toBeNull();
  });
});
