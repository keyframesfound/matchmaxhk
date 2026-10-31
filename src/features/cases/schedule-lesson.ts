/**
 * Issue #461 Phase A 3c — tutor "Schedule next lesson" rules (pure).
 *
 * One slot, no recurrence. Lessons 1 and 2 stay desk-run, so — like the
 * parent's requestSlot — a tutor schedules only once the case is fee_paid or
 * active. The overlap + F2F travel buffer reuse slot.ts.
 */

import { lessonConflicts, type ExistingLesson } from "@/features/cases/slot";

export const SCHEDULABLE_SOR_STATUSES: ReadonlySet<string> = new Set(["fee_paid", "active"]);
export const SCHEDULE_DURATION_MIN = 15;
export const SCHEDULE_DURATION_MAX = 480;
export const SCHEDULE_DURATION_STEP = 15;
export const SCHEDULE_MAX_AHEAD_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ScheduleLessonError =
  "CASE_NOT_ACTIVE" | "BAD_TIME" | "IN_PAST" | "TOO_FAR_AHEAD" | "BAD_DURATION" | "SLOT_CONFLICT";

export function scheduleLessonError(input: {
  sorStatus: string | null;
  startsAtIso: string;
  durationMin: number;
  /** The case is online (no F2F travel buffer for this lesson). */
  online: boolean;
  now: Date;
  /** The tutor's live lessons across all cases (planned / confirmed / done). */
  existing: readonly ExistingLesson[];
}): ScheduleLessonError | null {
  if (!input.sorStatus || !SCHEDULABLE_SOR_STATUSES.has(input.sorStatus)) {
    return "CASE_NOT_ACTIVE";
  }
  const start = Date.parse(input.startsAtIso);
  if (Number.isNaN(start)) return "BAD_TIME";
  if (start <= input.now.getTime()) return "IN_PAST";
  if (start > input.now.getTime() + SCHEDULE_MAX_AHEAD_DAYS * DAY_MS) return "TOO_FAR_AHEAD";
  const d = input.durationMin;
  if (
    !Number.isInteger(d) ||
    d < SCHEDULE_DURATION_MIN ||
    d > SCHEDULE_DURATION_MAX ||
    d % SCHEDULE_DURATION_STEP !== 0
  ) {
    return "BAD_DURATION";
  }
  const conflict = lessonConflicts(
    new Date(start),
    d,
    [...input.existing],
    input.online ? "online" : "f2f",
  );
  return conflict ? "SLOT_CONFLICT" : null;
}

/** Next sequence for a case: max + 1, never reusing a cancelled/voided slot. */
export function nextLessonSequence(lessons: readonly { sequence: number }[]): number {
  return lessons.reduce((max, l) => Math.max(max, l.sequence), 0) + 1;
}
