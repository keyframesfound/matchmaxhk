/**
 * Issue #202, Tutor home pure helpers.
 *
 * The Tutor home section reads the same `getMyTutorCases` payload as the
 * Lessons tab and derives "what to do today": the next lesson, the slot
 * requests still waiting for this tutor's confirm, and nothing else. All
 * derivation lives here so the vitest suite can exercise the rules directly;
 * the component stays a dumb renderer.
 */

import { isRequestExpired } from "@/features/cases/sor";

/** One lesson flattened with the case context the home cards display. */
export type HomeLesson = {
  lessonId: string;
  caseId: string;
  caseCode: string;
  sequence: number;
  /** ISO timestamp from case_lessons.starts_at. */
  startsAt: string;
  durationMin: number;
  status: string;
  /** ISO timestamp from case_lessons.created_at (request time, for expiry). */
  createdAt: string;
  confirmedByTutorAt: string | null;
  locationOrLink: string | null;
  studentFirstName: string;
  subject: string | null;
  examSystem: string | null;
  station: string | null;
  lessonMode: string | null;
  /** #443 short-case chip inputs (false/null on legacy rows). */
  isShortCase?: boolean;
  scheduledLessonCount?: number | null;
};

const LIVE_STATUSES = new Set(["planned", "confirmed"]);

export function isLiveLesson(status: string): boolean {
  return LIVE_STATUSES.has(status);
}

/** A lesson still counts as "the next one" until its scheduled end. */
function hasEnded(lesson: HomeLesson, now: Date): boolean {
  const end = new Date(lesson.startsAt).getTime() + lesson.durationMin * 60 * 1000;
  return end <= now.getTime();
}

/**
 * The earliest live lesson that has not ended yet, across all of the tutor's
 * cases. Cancelled/no_show/done rows never qualify.
 */
export function pickNextLesson(lessons: HomeLesson[], now: Date): HomeLesson | null {
  let next: HomeLesson | null = null;
  for (const lesson of lessons) {
    if (!isLiveLesson(lesson.status)) continue;
    if (hasEnded(lesson, now)) continue;
    if (next === null || new Date(lesson.startsAt) < new Date(next.startsAt)) {
      next = lesson;
    }
  }
  return next;
}

/**
 * Slot requests waiting on THIS tutor's confirm (#202 "Requests waiting for
 * this tutor's confirm"): planned, tutor has not confirmed, the 12h request
 * window has not expired, and the slot has not already passed.
 */
export function pendingTutorConfirms(lessons: HomeLesson[], now: Date): HomeLesson[] {
  return lessons
    .filter(
      (lesson) =>
        lesson.status === "planned" &&
        lesson.confirmedByTutorAt === null &&
        !isRequestExpired(new Date(lesson.createdAt), now) &&
        !hasEnded(lesson, now),
    )
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

/** Display mode for a lesson's case: "online" wins, otherwise station, else f2f. */
export function lessonPlaceLabel(
  lesson: Pick<HomeLesson, "lessonMode" | "station">,
): "online" | "station" | "f2f" {
  if (lesson.lessonMode === "online") return "online";
  if (lesson.station) return "station";
  return "f2f";
}
