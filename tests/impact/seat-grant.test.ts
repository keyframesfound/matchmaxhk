import { describe, expect, it } from "vitest";

import {
  SEAT_CAP,
  canGrantSeat,
  seatsRemaining,
  seatsUsed,
} from "../../src/features/impact/seat-grant";

/** Issue #794 AC-400-4: one unsold seat, never a seventh child. */
describe("seat cap", () => {
  it("mirrors the six-seat small-group limit", () => {
    expect(SEAT_CAP).toBe(6);
  });

  it("counts sold seats and granted seats together", () => {
    expect(seatsUsed({ studentCount: 4, grantedSeats: 1 })).toBe(5);
    expect(seatsUsed({ studentCount: 0, grantedSeats: 0 })).toBe(0);
  });

  it("never reports a negative remaining count", () => {
    expect(seatsRemaining({ studentCount: 6, grantedSeats: 2 })).toBe(0);
    expect(seatsRemaining({ studentCount: 5, grantedSeats: 0 })).toBe(1);
  });

  it("refuses a grant once the class is full", () => {
    expect(canGrantSeat({ studentCount: 6, grantedSeats: 0 })).toBe(false);
    expect(canGrantSeat({ studentCount: 5, grantedSeats: 1 })).toBe(false);
    expect(canGrantSeat({ studentCount: 5, grantedSeats: 0 })).toBe(true);
  });

  it("tolerates junk input without opening the cap", () => {
    expect(seatsUsed({ studentCount: Number.NaN, grantedSeats: -3 })).toBe(0);
    expect(canGrantSeat({ studentCount: Number.NaN, grantedSeats: 0 })).toBe(true);
  });
});
