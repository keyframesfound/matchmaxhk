import { describe, expect, it } from "vitest";

import { cohortHoursWhenFull } from "../../src/features/tutors/availability-occupancy.functions";
import { emptyHourlyOpenHours } from "../../src/features/tutors/availability-grid-model";

/**
 * Issue #768 additional AC — a group/bootcamp cohort's weekly sessions occupy
 * the tutor's public hourly grid ONLY once every `max_seats` seat is taken.
 * A 1-on-1 confirm is immediate Busy; a cohort with a seat left is not.
 */

const MON_WED_SESSIONS = { mon: [6, 7], wed: [14, 15] };

function cohort(overrides: Partial<Parameters<typeof cohortHoursWhenFull>[0]> = {}) {
  return {
    status: "running",
    min_seats: 2,
    max_seats: 2,
    sessions: MON_WED_SESSIONS,
    ...overrides,
  };
}

/** One seat-holding case per booked student. */
function taken(seats: number) {
  return Array.from({ length: seats }, () => ({ status: "matched", student_count: 1 }));
}

describe("cohortHoursWhenFull (#768 group Busy only when full)", () => {
  it("seats 2/2 occupies the cohort's weekly slots on the tutor's grid", () => {
    const occupied = cohortHoursWhenFull(cohort(), taken(2));
    expect(occupied.mon).toEqual([6, 7]);
    expect(occupied.wed).toEqual([14, 15]);
    expect(occupied.tue).toEqual([]);
    expect(occupied.sun).toEqual([]);
  });

  it("seats 1/2 leaves the tutor's hours open", () => {
    expect(cohortHoursWhenFull(cohort(), taken(1))).toEqual(emptyHourlyOpenHours());
  });

  it("a closed cohort with zero seats left never occupies", () => {
    expect(cohortHoursWhenFull(cohort({ status: "closed" }), taken(2))).toEqual(
      emptyHourlyOpenHours(),
    );
  });

  it("min_seats is irrelevant to fullness — only max_seats decides", () => {
    // Two seats taken on a 2-seat cap is full even with a 6-seat start bar.
    expect(cohortHoursWhenFull(cohort({ min_seats: 6 }), taken(2)).mon).toEqual([6, 7]);
    // Forming below the start bar but with the cap reached is still full.
    expect(cohortHoursWhenFull(cohort({ status: "forming", min_seats: 1 }), taken(2)).mon).toEqual([
      6, 7,
    ]);
    // Below the cap is not full, whatever the start bar says.
    expect(cohortHoursWhenFull(cohort({ max_seats: 3, min_seats: 1 }), taken(2))).toEqual(
      emptyHourlyOpenHours(),
    );
  });

  it("null sessions claim nothing even when full", () => {
    expect(cohortHoursWhenFull(cohort({ sessions: null }), taken(2))).toEqual(
      emptyHourlyOpenHours(),
    );
    expect(cohortHoursWhenFull(cohort({ sessions: {} }), taken(2))).toEqual(emptyHourlyOpenHours());
  });

  it("a released seat (case no longer holding) frees the hours again", () => {
    const released = [{ status: "cancelled", student_count: 1 }, ...taken(1)];
    expect(cohortHoursWhenFull(cohort(), released)).toEqual(emptyHourlyOpenHours());
  });

  it("multi-student bookings count every student toward max_seats", () => {
    const familyBooking = [{ status: "contacted", student_count: 2 }];
    expect(cohortHoursWhenFull(cohort(), familyBooking).wed).toEqual([14, 15]);
  });
});
