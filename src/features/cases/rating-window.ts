/**
 * #794 §2.1 — ratings-loop timing rules (pure half, vitest-covered).
 *
 * CEO lock 2026-11-18 (authority: Part 4 question 1):
 *  - ONE eligible completed lesson unlocks the sheet AND publication.
 *  - One row per case per direction, edited in place.
 *  - After each NEW completed lesson the author may update the same row.
 *  - After each save the author has 14 days to edit again.
 *  - After the case ends, 14 days to leave or edit, then the review freezes.
 *  - No unlimited free rewrites with no new lesson once the window closed.
 *  - Before any eligible completed lesson: no public review at all, only a
 *    private desk report.
 *
 * No DB access here; the server fns and the sheet share these decisions.
 */

import {
  RATING_EDIT_WINDOW_DAYS,
  isEligibleReviewLesson,
  type LessonConfirmRow,
  type ReviewDirection,
} from "@/features/cases/case-reviews";

export const RATING_DAY_MS = 86_400_000;
export const RATING_EDIT_WINDOW_MS = RATING_EDIT_WINDOW_DAYS * RATING_DAY_MS;

/** #794: the private desk-report reasons locked by the ticket. */
export type DeskReportReason = "no_show" | "rude_unsafe" | "never_confirmed" | "other";

export const DESK_REPORT_REASONS: readonly DeskReportReason[] = [
  "no_show",
  "rude_unsafe",
  "never_confirmed",
  "other",
];

export const DESK_REPORT_DETAIL_MAX = 1000;
export const RATING_DESK_NOTE_MAX = 500;

export type RatingWindowReason =
  | "no_eligible_lesson"
  | "open_first"
  | "open_new_lesson"
  | "open_edit_window"
  | "open_case_end_window"
  | "frozen_edit_window"
  | "frozen_case_ended";

export type RatingWindowState = {
  /** May the author write (insert or edit) the review right now? */
  canWrite: boolean;
  /** May the row publish publicly (parent→tutor only, after one lesson)? */
  canPublish: boolean;
  reason: RatingWindowReason;
  /** When the current window closes (ISO), null while a new lesson keeps it open. */
  freezeAt: string | null;
  eligibleLessons: number;
  /** Whole days left in the window (null when unbounded/closed). */
  daysLeft: number | null;
};

/** Count of COMPLETED (eligible) lessons on a case. */
export function completedLessonCount(
  lessons: readonly (LessonConfirmRow & { starts_at?: string | null })[],
): number {
  return lessons.filter((l) => isEligibleReviewLesson(l)).length;
}

/** Latest completed-lesson start (ISO) — the "new lesson" reopen anchor. */
export function latestCompletedLessonAt(
  lessons: readonly (LessonConfirmRow & { starts_at?: string | null })[],
): string | null {
  let best: number | null = null;
  for (const l of lessons) {
    if (!isEligibleReviewLesson(l) || !l.starts_at) continue;
    const t = Date.parse(l.starts_at);
    if (Number.isNaN(t)) continue;
    if (best === null || t > best) best = t;
  }
  return best === null ? null : new Date(best).toISOString();
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysLeftUntil(freezeAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((freezeAt.getTime() - now.getTime()) / RATING_DAY_MS));
}

/**
 * Decide whether a rating may be written right now.
 *
 * Order of precedence:
 *  1. no eligible completed lesson → closed (private desk report only)
 *  2. case ended → 14 days from the end, then frozen for good
 *  3. never saved → open (first write after the first lesson)
 *  4. a new completed lesson since the last save → open (stay current)
 *  5. within 14 days of the last save → open (typo / cooling-off)
 *  6. otherwise → frozen
 */
export function evaluateRatingWindow(input: {
  now: Date | string;
  caseEndedAt?: Date | string | null;
  lastSavedAt?: Date | string | null;
  eligibleLessonsNow: number;
  eligibleLessonsAtSave?: number | null;
}): RatingWindowState {
  const now = toDate(input.now) ?? new Date();
  const endedAt = toDate(input.caseEndedAt);
  const savedAt = toDate(input.lastSavedAt);
  const lessons = Math.max(0, input.eligibleLessonsNow);

  if (lessons < 1) {
    return {
      canWrite: false,
      canPublish: false,
      reason: "no_eligible_lesson",
      freezeAt: null,
      eligibleLessons: lessons,
      daysLeft: null,
    };
  }

  // Case ended: a flat 14-day window for both leaving and editing, then frozen.
  if (endedAt) {
    const freezeAt = new Date(endedAt.getTime() + RATING_EDIT_WINDOW_MS);
    const open = now.getTime() <= freezeAt.getTime();
    return {
      canWrite: open,
      canPublish: open,
      reason: open ? "open_case_end_window" : "frozen_case_ended",
      freezeAt: freezeAt.toISOString(),
      eligibleLessons: lessons,
      daysLeft: daysLeftUntil(freezeAt, now),
    };
  }

  if (!savedAt) {
    return {
      canWrite: true,
      canPublish: true,
      reason: "open_first",
      freezeAt: null,
      eligibleLessons: lessons,
      daysLeft: null,
    };
  }

  const freezeAt = new Date(savedAt.getTime() + RATING_EDIT_WINDOW_MS);
  const inWindow = now.getTime() <= freezeAt.getTime();
  const atSave = input.eligibleLessonsAtSave ?? null;
  const newLesson = atSave !== null && lessons > atSave;

  if (newLesson || inWindow) {
    return {
      canWrite: true,
      canPublish: true,
      reason: newLesson ? "open_new_lesson" : "open_edit_window",
      // A new lesson extends the window to 14 days from THIS save, so the
      // deadline only exists once a save has happened.
      freezeAt: newLesson ? null : freezeAt.toISOString(),
      eligibleLessons: lessons,
      daysLeft: newLesson ? null : daysLeftUntil(freezeAt, now),
    };
  }

  return {
    canWrite: false,
    canPublish: false,
    reason: "frozen_edit_window",
    freezeAt: freezeAt.toISOString(),
    eligibleLessons: lessons,
    daysLeft: 0,
  };
}

/** #794: tutor→parent rows never publish publicly (family/child privacy). */
export function directionPublishesPublicly(direction: ReviewDirection): boolean {
  return direction === "parent_to_tutor";
}

/**
 * #794: before the first eligible completed lesson a public review is
 * impossible — the participant gets the private desk-report path instead.
 */
export function privateReportOnly(eligibleLessonsNow: number): boolean {
  return eligibleLessonsNow < 1;
}
