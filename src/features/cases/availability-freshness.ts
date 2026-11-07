/**
 * Issue #673 — 14-day availability freshness rule (pure).
 *
 * Tutors let their weekly grids go stale, forcing ops to chase them for the
 * current semester's slots. The lock: if now − availability_confirmed_at is
 * more than 14 days, the tutor's Profile Strength temporarily deducts 15
 * points and surfaces a 1-tap "Confirm schedule is up to date" CTA which
 * resets availability_confirmed_at = now() without touching the grid.
 */

export const FRESHNESS_WINDOW_DAYS = 14;
/** Temporary Profile Strength deduction while the grid is stale. */
export const FRESHNESS_STRENGTH_DEDUCTION = 15;

export type AvailabilityFreshness = {
  /** Days since the last 1-tap confirmation (null = never confirmed). */
  daysSinceConfirmed: number | null;
  stale: boolean;
  /** True when the tutor has never confirmed (fresh profile, soft nudge). */
  neverConfirmed: boolean;
  strengthDeduction: number;
};

export function availabilityFreshness(
  confirmedAt: string | null | undefined,
  now: Date = new Date(),
): AvailabilityFreshness {
  if (!confirmedAt) {
    return {
      daysSinceConfirmed: null,
      stale: false,
      neverConfirmed: true,
      strengthDeduction: 0,
    };
  }
  const ms = Date.parse(confirmedAt);
  if (!Number.isFinite(ms)) {
    return {
      daysSinceConfirmed: null,
      stale: false,
      neverConfirmed: true,
      strengthDeduction: 0,
    };
  }
  const days = Math.floor((now.getTime() - ms) / (24 * 60 * 60 * 1000));
  const stale = days > FRESHNESS_WINDOW_DAYS;
  return {
    daysSinceConfirmed: days,
    stale,
    neverConfirmed: false,
    strengthDeduction: stale ? FRESHNESS_STRENGTH_DEDUCTION : 0,
  };
}
