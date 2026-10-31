import { z } from "zod";

/**
 * Issue #459 slice 3: verified hours ledger (public.verified_hours_ledger).
 * A lesson marked done writes a pending row (DB trigger); the parent
 * confirms or disputes it, and an hourly cron verifies anything left
 * pending past AUTO_VERIFY_HOURS. Only verified rows count publicly.
 */

/** Keep in sync with the interval in verify_due_hours() (migration). */
export const AUTO_VERIFY_HOURS = 24;

export const LEDGER_STATUSES = [
  "pending_confirmation",
  "verified_completed",
  "disputed",
  "cancelled",
] as const;
export type LedgerStatus = (typeof LEDGER_STATUSES)[number];

export const DisputeReason = z.string().trim().min(3).max(500);

const HOUR_MS = 3_600_000;

/** Postgres numeric arrives as a string from PostgREST. */
export function sumVerifiedHours(
  rows: readonly { status: string; duration_hours: number | string }[],
): number {
  const total = rows
    .filter((row) => row.status === "verified_completed")
    .reduce((sum, row) => sum + Number(row.duration_hours), 0);
  return Math.round(total * 100) / 100;
}

export function canParentReviewHours(
  row: { status: string; pending_since: string },
  now: Date,
): boolean {
  if (row.status !== "pending_confirmation") return false;
  return now.getTime() - new Date(row.pending_since).getTime() < AUTO_VERIFY_HOURS * HOUR_MS;
}

/** #459 §15.8 Phase 0 teaching badges: pure recompute from the ledger sum. */
export const RISING_HOURS = 25;
export const AZURE_HOURS = 100;

/** #459 §4.2 step 4: a tutor's own verified learning hours unlock Scholar. */
export const SCHOLAR_LEARNING_HOURS = 10;

export type TeachingBadge = "rising" | "azure";

export function teachingBadge(teachingHours: number): TeachingBadge | null {
  if (teachingHours >= AZURE_HOURS) return "azure";
  if (teachingHours >= RISING_HOURS) return "rising";
  return null;
}

export function isVerifiedScholar(learningHours: number): boolean {
  return learningHours >= SCHOLAR_LEARNING_HOURS;
}
