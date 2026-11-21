/**
 * Issue #768 CEO lock (14-day freshness): the "confirm the grid" rule is
 * retargeted to a gentle Dashboard nudge — "Are these Open hours still free?"
 * — never an automatic close of Open hours, and never auto-Busy.
 *
 * The timestamp is `tutors.availability_grid_hourly_reviewed_at`, refreshed by
 * both saving the hourly editor and dismissing the nudge. This module owns the
 * date arithmetic only; the caller decides whether a grid worth reviewing
 * exists at all.
 */

/** Days between freshness nudges. */
export const FRESHNESS_REVIEW_DAYS = 14;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * True when the tutor should be asked to re-confirm their Open hours.
 *
 * - never reviewed (missing, empty or unparseable) → true
 * - reviewed 14 or more days ago → true
 * - reviewed within the last 14 days → false
 */
export function needsFreshnessReview(
  reviewedAt: string | Date | null | undefined,
  now: Date = new Date(),
  days: number = FRESHNESS_REVIEW_DAYS,
): boolean {
  if (!reviewedAt) return true;
  const reviewed = reviewedAt instanceof Date ? reviewedAt : new Date(reviewedAt);
  const reviewedMs = reviewed.getTime();
  if (!Number.isFinite(reviewedMs)) return true;
  const windowMs = Math.max(0, days) * MS_PER_DAY;
  return now.getTime() - reviewedMs >= windowMs;
}
