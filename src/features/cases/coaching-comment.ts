/**
 * Issue #785 AC-735-2b — post-lesson coaching comment, pure rules.
 *
 * A tutor writes up to 1,500 characters after a lesson. It is party-visible and
 * deliberately separate from the #767 Super-Drawer log (which stays one recap
 * string) and from `case_lessons.private_note` (tutor-private). Everything here
 * is DB-free so the limits, the write rule and the numbering are testable.
 *
 * #785 AC-CONV-4 adds the one optional `https://` link that rides with it.
 */

import { isAllowedHomeworkLink } from "@/features/cases/homework";

export const COACHING_COMMENT_MAX = 1500;

/** #785 AC-CONV-4: one optional `https://` link travels with the comment. */
export const COACHING_URL_MAX = 500;

/** Only lessons that have started can carry a comment. */
export const COACHING_FEED_LIMIT = 10;

export type CoachingCommentResult =
  { ok: true; text: string | null } | { ok: false; code: "TOO_LONG" };

/**
 * Trim, then either keep the comment or clear it.
 *
 * Length is checked in code points (not UTF-16 units) so this agrees with the
 * database's `char_length` check: an emoji-heavy comment that Postgres accepts
 * is not rejected here first, and nothing Postgres would reject gets through.
 */
export function normaliseCoachingComment(input: unknown): CoachingCommentResult {
  if (input === null || input === undefined) return { ok: true, text: null };
  if (typeof input !== "string") return { ok: false, code: "TOO_LONG" };
  const text = input.trim();
  if (text.length === 0) return { ok: true, text: null };
  if ([...text].length > COACHING_COMMENT_MAX) return { ok: false, code: "TOO_LONG" };
  return { ok: true, text };
}

/** The matched tutor writes the coaching note; Ops may on their behalf. */
export function canWriteCoachingComment(role: "tutor" | "parent", isOps: boolean): boolean {
  return role === "tutor" || isOps;
}

export type CoachingUrlResult = { ok: true; url: string | null } | { ok: false; code: "BAD_LINK" };

/**
 * #785 AC-CONV-4: the link that rides with the comment.
 *
 * `https` only and never a direct-contact host, so the coaching note cannot be
 * used to hand out a WhatsApp or Instagram address the desk never sees. Clearing
 * (null, empty or whitespace) is always allowed.
 */
export function normaliseCoachingUrl(input: unknown): CoachingUrlResult {
  if (input === null || input === undefined) return { ok: true, url: null };
  if (typeof input !== "string") return { ok: false, code: "BAD_LINK" };
  const url = input.trim();
  if (url.length === 0) return { ok: true, url: null };
  if (url.length > COACHING_URL_MAX) return { ok: false, code: "BAD_LINK" };
  return isAllowedHomeworkLink(url) ? { ok: true, url } : { ok: false, code: "BAD_LINK" };
}

/** Fail closed: a missing or unparseable start time never counts as started. */
export function lessonStarted(startsAt: string | null, now: Date): boolean {
  if (!startsAt) return false;
  const ms = Date.parse(startsAt);
  if (!Number.isFinite(ms)) return false;
  return ms <= now.getTime();
}

/**
 * "Lesson #N": the stored `sequence` when it is a positive integer, else the
 * 1-based position among the case's lessons ordered by start time. Mirrors
 * `lesson-log-logic.ts`, which keeps its version private.
 */
export function coachingLessonNumber(
  lessons: readonly { id: string; sequence: number | null; starts_at: string | null }[],
): Map<string, number> {
  const ordered = [...lessons].sort((a, b) => {
    const at = a.starts_at ? Date.parse(a.starts_at) : NaN;
    const bt = b.starts_at ? Date.parse(b.starts_at) : NaN;
    const aOk = Number.isFinite(at);
    const bOk = Number.isFinite(bt);
    if (aOk && bOk && at !== bt) return at - bt;
    if (aOk !== bOk) return aOk ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const numbers = new Map<string, number>();
  ordered.forEach((lesson, index) => {
    const sequence =
      typeof lesson.sequence === "number" && Number.isFinite(lesson.sequence) && lesson.sequence > 0
        ? Math.trunc(lesson.sequence)
        : index + 1;
    numbers.set(lesson.id, sequence);
  });
  return numbers;
}
