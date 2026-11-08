/**
 * Issue #715 — tutor open-slot capacity math (pure, vitest-covered).
 *
 * Capacity itself lives on tutors.remaining_student_slots /
 * tutors.is_accepting_students (migration 2025xxxx, already live). This module
 * holds the two pure rules the app layers need:
 *
 *  1. decrementTutorCapacity — a confirmed match consumes one open slot
 *     (floor 0); reaching 0 flips the tutor to not-accepting until they
 *     manually raise the count again. It never flips a paused tutor back on.
 *  2. isTutorOpenForDiscovery — the discovery filter for homepage carousels
 *     and recommendation feeds: only accepting tutors with ≥ 1 open slot.
 *     Missing columns (pre-migration rows) count as open, matching
 *     isTutorFullyBooked's tolerance so both helpers always agree.
 */

export type TutorCapacityInput = {
  isAcceptingStudents: boolean | null | undefined;
  remainingStudentSlots: number | null | undefined;
};

export type TutorCapacity = {
  remainingStudentSlots: number;
  isAcceptingStudents: boolean;
};

export function decrementTutorCapacity(current: TutorCapacityInput): TutorCapacity {
  const previous =
    typeof current.remainingStudentSlots === "number"
      ? Math.max(0, Math.round(current.remainingStudentSlots))
      : 0;
  const remainingStudentSlots = Math.max(0, previous - 1);
  // At zero the tutor is full: flip to not-accepting. Otherwise keep the
  // owner's toggle exactly as it was (never silently re-enable a paused card).
  const isAcceptingStudents =
    remainingStudentSlots === 0 ? false : current.isAcceptingStudents !== false;
  return { remainingStudentSlots, isAcceptingStudents };
}

/**
 * Discovery-facing open check (issue #715 ship-now lock): homepage
 * popular/featured carousels and recommendation feeds must exclude tutors
 * with accepting_students = false OR remaining_slots = 0. Null/missing slots
 * count as open so pre-migration rows keep rendering.
 */
export function isTutorOpenForDiscovery(tutor: {
  is_accepting_students?: boolean | null;
  remaining_student_slots?: number | null;
}): boolean {
  if (tutor.is_accepting_students === false) return false;
  if (typeof tutor.remaining_student_slots === "number") return tutor.remaining_student_slots >= 1;
  return true;
}
