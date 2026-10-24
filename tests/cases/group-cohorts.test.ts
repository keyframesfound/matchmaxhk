import { describe, expect, it } from "vitest";

import {
  cohortAdminFeeHkd,
  cohortAvailability,
  cohortSeatsTaken,
} from "../../src/features/cases/group-cohorts";

describe("cohort seat math (#391)", () => {
  it("sums student_count across live cases only", () => {
    expect(
      cohortSeatsTaken([
        { status: "new", student_count: 2 },
        { status: "contacted", student_count: 1 },
        { status: "matched", student_count: 3 },
      ]),
    ).toBe(6);
    // Closed / rejected bookings free their seats.
    expect(
      cohortSeatsTaken([
        { status: "closed", student_count: 2 },
        { status: "rejected", student_count: 3 },
      ]),
    ).toBe(0);
    // Garbage counts clamp to 1.
    expect(cohortSeatsTaken([{ status: "new", student_count: 0 }])).toBe(1);
  });

  it("derives forming until the min-seats bar, running after (or early start)", () => {
    const cohort = { status: "forming", max_seats: 4, min_seats: 2 };
    expect(cohortAvailability(cohort, []).state).toBe("forming");
    expect(cohortAvailability(cohort, [{ status: "new", student_count: 2 }]).state).toBe("running");
    // Tutor-confirmed early start flips the row status.
    expect(cohortAvailability({ ...cohort, status: "running" }, []).state).toBe("running");
  });

  it("full when seats are gone; closed never books", () => {
    const cohort = { status: "forming", max_seats: 3, min_seats: 2 };
    const full = cohortAvailability(cohort, [{ status: "matched", student_count: 3 }]);
    expect(full.state).toBe("full");
    expect(full.bookable).toBe(false);
    expect(full.seatsLeft).toBe(0);
    expect(cohortAvailability({ ...cohort, status: "closed" }, []).bookable).toBe(false);
  });

  it("forming cohorts still book while seats remain", () => {
    const availability = cohortAvailability({ status: "forming", max_seats: 6, min_seats: 2 }, [
      { status: "new", student_count: 1 },
    ]);
    expect(availability.state).toBe("forming");
    expect(availability.bookable).toBe(true);
    expect(availability.seatsLeft).toBe(5);
  });

  it("admin fee scales 1.5 × per-student rate × seats, total-rounded", () => {
    expect(cohortAdminFeeHkd(500, 3)).toBe(2250);
    expect(cohortAdminFeeHkd(220, 2)).toBe(660);
  });
});
