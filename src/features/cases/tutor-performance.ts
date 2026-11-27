/**
 * GitHub #736 AC6: the assigned tutor's 12-week operating metrics, pure half.
 * Weeks are HKT calendar weeks starting Monday 00:00, matching how the rest of
 * the case desk reads lesson and homework activity (#204 HKT helpers).
 */

import { hktDateKey, hktWeekdayIndex } from "@/features/cases/sor";

/** How many Monday-anchored weeks the panel reports. */
export const PERF_WEEKS = 12;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** One verified_completed ledger row, dated to the moment it occurred. */
export type PerfHoursRow = { occurredAt: string; hours: number };
/** One case_homework row; reviewedAt is null until the tutor reviews it. */
export type PerfHomeworkRow = { dueAt: string; reviewedAt: string | null };
/** One visible parent-to-tutor review of this tutor. */
export type PerfReviewRow = { rating: number; createdAt: string };

export type PerfWeek = { weekStart: string; hours: number };

export type HomeworkCompletion = {
  assigned: number;
  reviewed: number;
  /** reviewed / assigned in whole percent; null when nothing was assigned. */
  rate: number | null;
};

export type RollingRating = {
  /** Mean rating to 1 dp; null when there are no visible reviews. */
  average: number | null;
  count: number;
};

export type TutorPerformance = {
  /** Exactly PERF_WEEKS buckets, oldest first. */
  weeks: PerfWeek[];
  homework: HomeworkCompletion;
  rating: RollingRating;
  totalHours: number;
};

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

/** The HKT Monday date key of the week a timestamp falls in. */
function weekStartOf(at: Date): string {
  return hktDateKey(new Date(at.getTime() - hktWeekdayIndex(at) * DAY_MS));
}

/**
 * The last PERF_WEEKS Monday 00:00 HKT week starts, oldest first. The current
 * (partial) week is included, so the newest key is always the week of `now`.
 */
export function weekStarts(now: Date): string[] {
  const mondayMs = Date.parse(`${weekStartOf(now)}T00:00:00Z`);
  return Array.from({ length: PERF_WEEKS }, (_, i) =>
    new Date(mondayMs - (PERF_WEEKS - 1 - i) * WEEK_MS).toISOString().slice(0, 10),
  );
}

/**
 * Verified hours bucketed into the given weeks, one bucket per start in the
 * same order. Rows outside the window contribute nothing; each bucket is
 * rounded to 1 dp.
 */
export function weeklyVerifiedHours(
  rows: readonly PerfHoursRow[],
  starts: readonly string[],
): PerfWeek[] {
  const totals = new Map<string, number>(starts.map((start) => [start, 0]));
  for (const row of rows) {
    const at = new Date(row.occurredAt);
    if (Number.isNaN(at.getTime()) || !Number.isFinite(row.hours)) continue;
    const key = weekStartOf(at);
    if (!totals.has(key)) continue;
    totals.set(key, (totals.get(key) ?? 0) + row.hours);
  }
  return starts.map((weekStart) => ({ weekStart, hours: roundOne(totals.get(weekStart) ?? 0) }));
}

/** Homework assigned in the window vs those the tutor has reviewed. */
export function homeworkCompletion(rows: readonly PerfHomeworkRow[]): HomeworkCompletion {
  const assigned = rows.length;
  const reviewed = rows.filter((row) => row.reviewedAt !== null).length;
  return {
    assigned,
    reviewed,
    rate: assigned === 0 ? null : Math.round((reviewed / assigned) * 100),
  };
}

/** Mean visible rating to 1 dp, with the count behind it. */
export function rollingRating(reviews: readonly PerfReviewRow[]): RollingRating {
  const count = reviews.length;
  if (count === 0) return { average: null, count: 0 };
  const sum = reviews.reduce((total, row) => total + row.rating, 0);
  return { average: roundOne(sum / count), count };
}

/** Everything the panel renders, computed from the three reads. */
export function perfFrom(
  input: {
    hoursRows: readonly PerfHoursRow[];
    homeworkRows: readonly PerfHomeworkRow[];
    reviewRows: readonly PerfReviewRow[];
  },
  now: Date,
): TutorPerformance {
  const weeks = weeklyVerifiedHours(input.hoursRows, weekStarts(now));
  return {
    weeks,
    homework: homeworkCompletion(input.homeworkRows),
    rating: rollingRating(input.reviewRows),
    totalHours: roundOne(weeks.reduce((sum, week) => sum + week.hours, 0)),
  };
}
