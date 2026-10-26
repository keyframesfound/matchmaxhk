/**
 * Issue #391, Small Group Classes: cohort seat math + display state.
 *
 * Pure helpers shared by the tutor dashboard manager, the public
 * /group-classes board and the vitest suite. Seats taken are never stored —
 * they derive from the cohort's live tutoring_cases rows (student_count,
 * excluding closed/rejected), so cancellations free seats automatically and
 * unrelated parents never share a row (PDPO: each booking is an isolated
 * 1-on-1 case linked by group_cohort_id).
 */

import { fullAdminFeeAmount } from "@/features/cases/fee-breakdown";

/** Cap. 279: hard 2-6 seat band for every tutor at launch (issue #391). */
export const COHORT_MIN_SEATS = 2;
export const COHORT_MAX_SEATS = 6;
/** "Min Seats to Start" default, a cohort shows as Forming until this bar. */
export const COHORT_MIN_TO_START_DEFAULT = 2;

export const COHORT_TITLE_MAX = 120;
export const COHORT_SCHEDULE_MAX = 120;
export const COHORT_DESCRIPTION_MAX = 1000;

export type CohortStatus = "forming" | "running" | "closed";

/** One sibling inside a multi-seat booking (the parent's own account). */
export type CohortStudentInput = {
  firstName: string;
  grade: string;
};

/** Statuses that keep a case occupying its cohort seats. */
const SEAT_HOLDING_STATUSES = new Set(["new", "contacted", "matched"]);

/** Sum of booked students across the cohort's live cases. */
export function cohortSeatsTaken(cases: { status: string; student_count: number }[]): number {
  return cases.reduce((sum, c) => {
    const count = Number.isInteger(c.student_count) && c.student_count >= 1 ? c.student_count : 1;
    return SEAT_HOLDING_STATUSES.has(c.status) ? sum + count : sum;
  }, 0);
}

export type CohortAvailabilityState = "forming" | "running" | "full" | "closed";

export type CohortAvailability = {
  /** Render state: forming / running / full / closed. */
  state: CohortAvailabilityState;
  seatsTaken: number;
  seatsLeft: number;
  maxSeats: number;
  minSeatsToStart: number;
  /** True once the min-seats bar is met (or the tutor confirmed early). */
  hasStarted: boolean;
  /** Whether the parent can book seats right now. */
  bookable: boolean;
};

/**
 * Derive a cohort's booking state from its row + live case sums. A forming
 * cohort still books (parents join while seats remain); "full" and "closed"
 * never do.
 */
export function cohortAvailability(
  cohort: { status: string; max_seats: number; min_seats: number },
  liveCases: { status: string; student_count: number }[],
): CohortAvailability {
  const maxSeats = cohort.max_seats;
  const minSeatsToStart = Math.max(1, cohort.min_seats);
  const seatsTaken = cohortSeatsTaken(liveCases);
  const seatsLeft = Math.max(0, maxSeats - seatsTaken);
  const hasStarted = cohort.status === "running" || seatsTaken >= minSeatsToStart;
  const state: CohortAvailabilityState =
    cohort.status === "closed"
      ? "closed"
      : seatsLeft <= 0
        ? "full"
        : hasStarted
          ? "running"
          : "forming";
  return {
    state,
    seatsTaken,
    seatsLeft,
    maxSeats,
    minSeatsToStart,
    hasStarted,
    bookable: state === "forming" || state === "running",
  };
}

/**
 * Admin fee for a cohort booking: 1.5 × per-student rate × student count
 * (100% Lesson 1 + 50% Lesson 2 per student). Reuses the #385 helper so the
 * booking preview and the desk invoice agree to the dollar.
 */
export function cohortAdminFeeHkd(perStudentRateHkd: number, seats: number): number {
  return fullAdminFeeAmount(perStudentRateHkd, seats);
}
