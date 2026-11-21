import { describe, expect, it } from "vitest";

import { selectTutorCardSocialProof } from "../../src/features/tutors/card-social-proof";
import {
  countOpenHourSlots,
  emptyHourlyOpenHours,
  type HourlyOpenHours,
} from "../../src/features/tutors/availability-grid-model";

/** Hourly grid with only the days the test cares about filled in. */
function hours(entries: Partial<HourlyOpenHours>): HourlyOpenHours {
  return { ...emptyHourlyOpenHours(), ...entries };
}

describe("countOpenHourSlots (#768 AC3 slots left)", () => {
  it("counts zero when nothing is Open", () => {
    expect(countOpenHourSlots(emptyHourlyOpenHours(), emptyHourlyOpenHours())).toBe(0);
  });

  it("counts exactly one Open cell as the last slot", () => {
    expect(countOpenHourSlots(hours({ mon: [10] }), emptyHourlyOpenHours())).toBe(1);
  });

  it("counts every Open cell across days", () => {
    expect(
      countOpenHourSlots(hours({ mon: [9, 10], wed: [14], sun: [21] }), emptyHourlyOpenHours()),
    ).toBe(4);
  });

  it("an Occupied booking removes the cell from the count", () => {
    expect(countOpenHourSlots(hours({ mon: [10, 11] }), hours({ mon: [10] }))).toBe(1);
    expect(countOpenHourSlots(hours({ mon: [10, 11] }), hours({ mon: [10, 11] }))).toBe(0);
  });

  it("an Occupied hour the tutor has closed is clipped and never double-counted", () => {
    // Open only 10:00; the booking sits at 12:00 (already Closed) — 10:00 stays
    // bookable, and the out-of-range booking cannot subtract anything.
    expect(countOpenHourSlots(hours({ mon: [10] }), hours({ mon: [12] }))).toBe(1);
  });
});

describe("selectTutorCardSocialProof slotsLeft truth table (#768 AC3)", () => {
  it("one slot left with an active class running flags the last slot", () => {
    expect(selectTutorCardSocialProof({ slotsLeft: 1, activeCasesCount: 2 }).lastSlot).toBe(true);
  });

  it("one slot left without enough active classes does not flag it", () => {
    expect(selectTutorCardSocialProof({ slotsLeft: 1, activeCasesCount: 1 }).lastSlot).toBe(false);
  });

  it("zero or two slots left never flags the last slot", () => {
    expect(selectTutorCardSocialProof({ slotsLeft: 0, activeCasesCount: 5 }).lastSlot).toBe(false);
    expect(selectTutorCardSocialProof({ slotsLeft: 2, activeCasesCount: 5 }).lastSlot).toBe(false);
  });

  it("end-to-end: occupancy leaves one Open cell and the class count clears the bar", () => {
    const open = hours({ tue: [9, 10, 11] });
    const occupied = hours({ tue: [9, 11] });
    const slotsLeft = countOpenHourSlots(open, occupied);
    expect(slotsLeft).toBe(1);
    expect(selectTutorCardSocialProof({ slotsLeft, activeCasesCount: 2 }).lastSlot).toBe(true);
  });

  it("end-to-end: occupancy leaving more than one Open cell renders no scarcity", () => {
    const open = hours({ tue: [9, 10, 11] });
    const occupied = hours({ tue: [9] });
    const slotsLeft = countOpenHourSlots(open, occupied);
    expect(slotsLeft).toBe(2);
    expect(selectTutorCardSocialProof({ slotsLeft, activeCasesCount: 2 }).lastSlot).toBe(false);
  });
});
