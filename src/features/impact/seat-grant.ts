/**
 * Issue #794 AC-400-4 — the desk half of the Impact programme, pure rules.
 *
 * Two grants hang off one staff-set flag: an empty seat in a small group class,
 * and a $0 shop item. The seat cap is Cap. 279's small-group limit, not a
 * product preference, so it lives in one place and the DB enforces the same
 * number — a drift between the two would let a seventh child into a six-child
 * class.
 */

/** Cap. 279 small-group ceiling, mirrored by the `CAP_REACHED` trigger. */
export const SEAT_CAP = 6;

export type SeatUsage = {
  /** `tutoring_cases.student_count` — seats already sold. */
  studentCount: number;
  /** Live grants recorded in `case_seat_grants`. */
  grantedSeats: number;
};

export function seatsUsed({ studentCount, grantedSeats }: SeatUsage): number {
  const sold = Number.isFinite(studentCount) ? Math.max(0, Math.trunc(studentCount)) : 0;
  const granted = Number.isFinite(grantedSeats) ? Math.max(0, Math.trunc(grantedSeats)) : 0;
  return sold + granted;
}

export function seatsRemaining(usage: SeatUsage): number {
  return Math.max(0, SEAT_CAP - seatsUsed(usage));
}

/**
 * A grant needs a real empty seat. At exactly the cap there is nothing to give
 * away, and a sold-out class must not be able to donate a seat a paying family
 * already occupies.
 */
export function canGrantSeat(usage: SeatUsage): boolean {
  return seatsRemaining(usage) > 0;
}
