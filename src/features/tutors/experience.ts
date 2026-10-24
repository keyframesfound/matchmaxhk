// Issue #387 — Tutor Verified Experience Log: pure rules.
//
// The public numbers ("18 lessons · 27 hours · Sep 2026 – Present") are
// computed STRICTLY from verified sessions — tutors can never type a total:
//  * intro lessons = case_lessons sequence 1/2 with status 'done'
//    (scheduled duration), and
//  * ongoing sessions = tutor_session_logs rows with status 'verified'.
// The live aggregate comes from the get_tutor_experience RPC (migration
// 20261023080000); everything here is the vitest-tested validation and
// formatting half that the server fns and UI call.
//
// Group sessions count ONCE by construction: one row per SESSION, never per
// student. Callers pass one ExperienceSession per session — there is no
// student-count parameter anywhere in the pipeline.

import { hktDateKey } from "@/features/cases/sor";

export const EXPERIENCE = {
  /** 0.5h increments, 0.5h–4.0h. */
  minDurationMin: 30,
  maxDurationMin: 240,
  durationStepMin: 30,
  /** Max 7-day backdating window. */
  backdateWindowDays: 7,
  /** A pending log auto-verifies 72h after creation unless disputed. */
  autoVerifyHours: 72,
  /** "– Present" shows while the last verified lesson is within 45 days. */
  presentWindowDays: 45,
  /** After 2 disputed logs on a Case the tutor can no longer log on it. */
  maxDisputesPerCase: 2,
} as const;

export type SessionLogInput = {
  logDate: string;
  startMinute: number;
  durationMin: number;
};

export type ExperienceGuardReason =
  | "BAD_DATE"
  | "FUTURE_DATE"
  | "TOO_OLD"
  | "BAD_DURATION"
  | "BAD_START"
  | "FEE_NOT_PAID"
  | "DISPUTE_LOCK"
  | "DUPLICATE_DAY";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function addDays(dateKey: string, days: number): string {
  const t = Date.parse(`${dateKey}T00:00:00Z`) + days * 24 * 60 * 60 * 1000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Validate one logged session against the anti-abuse guardrails.
 * `hktTodayKey` is today's HKT date (YYYY-MM-DD). Returns null when valid,
 * otherwise a stable reason code the UI maps to copy.
 */
export function validateSessionLogInput(
  input: SessionLogInput,
  hktTodayKey: string,
): ExperienceGuardReason | null {
  if (!DATE_RE.test(input.logDate) || Number.isNaN(Date.parse(`${input.logDate}T00:00:00Z`))) {
    return "BAD_DATE";
  }
  if (input.logDate > hktTodayKey) return "FUTURE_DATE";
  if (input.logDate < addDays(hktTodayKey, -EXPERIENCE.backdateWindowDays)) return "TOO_OLD";

  const d = input.durationMin;
  if (
    !Number.isInteger(d) ||
    d < EXPERIENCE.minDurationMin ||
    d > EXPERIENCE.maxDurationMin ||
    d % EXPERIENCE.durationStepMin !== 0
  ) {
    return "BAD_DURATION";
  }

  const s = input.startMinute;
  if (
    !Number.isInteger(s) ||
    s < 0 ||
    s > 1439 ||
    s + d > 24 * 60 // a session never crosses midnight
  ) {
    return "BAD_START";
  }
  return null;
}

/**
 * Case-level gate: the 1.5-lesson admin fee must be SETTLED — paid OR
 * admin-waived (the #425 review-fee precedent: a waived fee is an
 * obligation met, so a waived case stays loggable — Ryan-approved
 * 2026-10-23); 2 disputes lock.
 */
export function canLogOnCase(input: {
  feeStatuses: readonly string[];
  disputedCount: number;
}): ExperienceGuardReason | null {
  const settled = input.feeStatuses.some((s) => s === "paid" || s === "waived");
  if (!settled) return "FEE_NOT_PAID";
  if (input.disputedCount >= EXPERIENCE.maxDisputesPerCase) return "DISPUTE_LOCK";
  return null;
}

/** The exact moment a pending log flips to verified without a dispute. */
export function autoVerifyAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + EXPERIENCE.autoVerifyHours * 60 * 60 * 1000);
}

/** Hours the parent still has before a pending log auto-verifies (ceil, ≥0). */
export function disputeHoursLeft(createdAt: Date, now: Date): number {
  const left = autoVerifyAt(createdAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(left / (60 * 60 * 1000)));
}

// ---------------------------------------------------------------------------
// Counting + display range
// ---------------------------------------------------------------------------

export type ExperienceSession = {
  /** Session moment (UTC instant). */
  startsAt: Date;
  durationMin: number;
};

export type ExperienceTotals = {
  lessons: number;
  /** Fractional hours, rounded to 1 decimal. */
  hours: number;
  firstLessonAt: Date | null;
  lastLessonAt: Date | null;
};

/**
 * Count sessions for the public line. Each row counts ONCE — a group session
 * of five students is a single row and adds exactly 1 lesson + its elapsed
 * hours (never multiplied by the student count).
 */
export function computeExperienceTotals(sessions: ExperienceSession[]): ExperienceTotals {
  if (sessions.length === 0) {
    return { lessons: 0, hours: 0, firstLessonAt: null, lastLessonAt: null };
  }
  const minutes = sessions.reduce((sum, s) => sum + s.durationMin, 0);
  const times = sessions.map((s) => s.startsAt.getTime());
  return {
    lessons: sessions.length,
    hours: Math.round((minutes / 60) * 10) / 10,
    firstLessonAt: new Date(Math.min(...times)),
    lastLessonAt: new Date(Math.max(...times)),
  };
}

export type ExperienceRange = {
  /** HKT month keys "YYYY-MM". */
  startKey: string | null;
  endKey: string | null;
  /** True while the last verified lesson is within the 45-day window. */
  isPresent: boolean;
};

/** #387 Present rule: "– Present" only within 45 days of the last lesson. */
export function isWithinPresentWindow(lastLessonAt: Date | null, now: Date): boolean {
  if (!lastLessonAt) return false;
  return (
    now.getTime() - lastLessonAt.getTime() <= EXPERIENCE.presentWindowDays * 24 * 60 * 60 * 1000
  );
}

export function experienceRange(totals: ExperienceTotals, now: Date): ExperienceRange {
  if (totals.lessons === 0 || !totals.firstLessonAt || !totals.lastLessonAt) {
    return { startKey: null, endKey: null, isPresent: false };
  }
  return {
    startKey: hktDateKey(totals.firstLessonAt).slice(0, 7),
    endKey: hktDateKey(totals.lastLessonAt).slice(0, 7),
    isPresent: isWithinPresentWindow(totals.lastLessonAt, now),
  };
}

/** "27" / "27.5" — never "27.0" and never a 1-dp float artifact. */
export function formatExperienceHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Zero-state rule: 0 verified lessons → the component hides completely. */
export function isExperienceVisible(totals: ExperienceTotals): boolean {
  return totals.lessons > 0;
}
