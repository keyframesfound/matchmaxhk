import { describe, expect, it } from "vitest";

import {
  decrementTutorCapacity,
  isTutorOpenForDiscovery,
} from "../../src/features/tutors/capacity";

/**
 * Issue #715: a confirmed match consumes one open slot (floor 0); reaching 0
 * flips the tutor to not-accepting. Discovery feeds exclude full tutors.
 */

describe("decrementTutorCapacity", () => {
  it("decrements a normal count and keeps accepting on", () => {
    expect(decrementTutorCapacity({ remainingStudentSlots: 3, isAcceptingStudents: true })).toEqual(
      { remainingStudentSlots: 2, isAcceptingStudents: true },
    );
  });

  it("flips accepting off exactly at zero", () => {
    expect(decrementTutorCapacity({ remainingStudentSlots: 1, isAcceptingStudents: true })).toEqual(
      { remainingStudentSlots: 0, isAcceptingStudents: false },
    );
  });

  it("floors at zero and never goes negative", () => {
    expect(
      decrementTutorCapacity({ remainingStudentSlots: 0, isAcceptingStudents: false }),
    ).toEqual({ remainingStudentSlots: 0, isAcceptingStudents: false });
  });

  it("never flips a paused tutor back on when slots remain", () => {
    expect(
      decrementTutorCapacity({ remainingStudentSlots: 5, isAcceptingStudents: false }),
    ).toEqual({ remainingStudentSlots: 4, isAcceptingStudents: false });
  });

  it("treats missing slots as 0 (pre-migration row)", () => {
    expect(
      decrementTutorCapacity({ remainingStudentSlots: null, isAcceptingStudents: null }),
    ).toEqual({ remainingStudentSlots: 0, isAcceptingStudents: false });
  });

  it("rounds fractional storage values before decrementing (2.6 → 3 → 2)", () => {
    expect(
      decrementTutorCapacity({ remainingStudentSlots: 2.6, isAcceptingStudents: true }),
    ).toEqual({ remainingStudentSlots: 2, isAcceptingStudents: true });
  });
});

describe("isTutorOpenForDiscovery", () => {
  it("open when accepting with a slot", () => {
    expect(
      isTutorOpenForDiscovery({ is_accepting_students: true, remaining_student_slots: 2 }),
    ).toBe(true);
  });

  it("excluded at zero slots", () => {
    expect(
      isTutorOpenForDiscovery({ is_accepting_students: true, remaining_student_slots: 0 }),
    ).toBe(false);
  });

  it("excluded when the owner paused the card", () => {
    expect(
      isTutorOpenForDiscovery({ is_accepting_students: false, remaining_student_slots: 9 }),
    ).toBe(false);
  });

  it("missing columns count as open (pre-migration tolerance)", () => {
    expect(
      isTutorOpenForDiscovery({ is_accepting_students: null, remaining_student_slots: null }),
    ).toBe(true);
    expect(isTutorOpenForDiscovery({})).toBe(true);
  });
});
