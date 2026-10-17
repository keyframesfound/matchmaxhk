/**
 * Issues #201 + #204 + #287 — System-of-Record pure helpers.
 *
 * The canonical SoR status machine, admin-fee math, lesson timing rules and
 * HKT day helpers. Everything here is pure so the vitest suite can exercise
 * the rules directly (TanStack server fns call these; the DB trigger
 * sor_case_transition_guard is the backstop for out-of-band writes).
 */

export const SOR_STATUSES = [
  "draft",
  "introduced",
  "lesson_1_scheduled",
  "lesson_1_done",
  "lesson_2_scheduled",
  "lesson_2_done",
  "fee_invoiced",
  "fee_paid",
  "active",
  "replaced",
  "closed",
  "waived",
] as const;

export type SorStatus = (typeof SOR_STATUSES)[number];

/** #201 "Allowed transitions". Anything not listed fails and writes no audit row. */
export const ALLOWED_TRANSITIONS: Readonly<Record<SorStatus, readonly SorStatus[]>> = {
  draft: ["introduced", "closed"],
  introduced: ["lesson_1_scheduled", "closed"],
  lesson_1_scheduled: ["lesson_1_done", "closed"],
  lesson_1_done: ["lesson_2_scheduled", "fee_invoiced", "closed"],
  lesson_2_scheduled: ["lesson_2_done", "closed"],
  lesson_2_done: ["fee_invoiced"],
  fee_invoiced: ["fee_paid", "waived"],
  fee_paid: ["active"],
  active: ["replaced", "closed"],
  replaced: [],
  closed: [],
  waived: ["closed"],
};

export class IllegalTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`illegal case status transition ${from} -> ${to}`);
    this.name = "IllegalTransitionError";
  }
}

export function isLegalTransition(from: SorStatus, to: SorStatus): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

/** Server fns call this before persisting; the DB trigger repeats the check. */
export function assertTransition(from: SorStatus, to: SorStatus): void {
  if (!isLegalTransition(from, to)) {
    throw new IllegalTransitionError(from, to);
  }
}

// ---------------------------------------------------------------------------
// Admin fee (#201)
// ---------------------------------------------------------------------------

export const FEE_MULTIPLIER = 1.5;
/** #201 flow step 8: due in 3 days from invoice. */
export const FEE_DUE_DAYS = 3;

/** Fee amount is rate × multiplier at invoice time, in whole HKD cents. */
export function computeFeeAmountHkd(
  rateHkd: number,
  multiplier: number = FEE_MULTIPLIER,
): number {
  if (!Number.isFinite(rateHkd) || rateHkd < 0) return 0;
  if (!Number.isFinite(multiplier) || multiplier <= 0) return 0;
  return Math.round(rateHkd * multiplier * 100) / 100;
}

export function feeDueAtFrom(invoicedAt: Date): Date {
  return new Date(invoicedAt.getTime() + FEE_DUE_DAYS * 24 * 60 * 60 * 1000);
}

/** Only one fee per case may sit in an "open" state (matches the partial unique index). */
export function isFeeOpen(status: "not_due" | "invoiced" | "paid" | "waived" | "refunded"): boolean {
  return status === "not_due" || status === "invoiced" || status === "paid";
}

// ---------------------------------------------------------------------------
// Lesson status rules (#201 lessons 1–2, #204 calendar lessons)
// ---------------------------------------------------------------------------

export type LessonStatus =
  | "planned"
  | "confirmed"
  | "done"
  | "no_show"
  | "cancelled"
  | "late_cancel";

/** #204: mark done is available from 15 minutes before start until 7 days after. */
export const MARK_DONE_EARLY_MIN = 15;
export const MARK_DONE_LATE_DAYS = 7;
/** #204: a request with no tutor confirm expires in 12 hours. */
export const REQUEST_EXPIRY_HOURS = 12;
/** #204: cancel more than 12 hours before start reopens the slot; inside = late_cancel. */
export const CANCEL_WINDOW_HOURS = 12;
/** #204: F2F lessons of the same tutor need a 30-minute buffer; online has none. */
export const F2F_BUFFER_MIN = 30;
/** #204: an active student has a lesson in the last 30 days or a future confirmed lesson. */
export const ACTIVE_STUDENT_WINDOW_DAYS = 30;
/** #204: Tutor Plus banner at 4+ active students on an individual organisation. */
export const TUTOR_PLUS_THRESHOLD = 4;
export const TUTOR_PLUS_PRICE_HKD = 98;

export function canMarkDone(startsAt: Date, now: Date): boolean {
  const early = startsAt.getTime() - MARK_DONE_EARLY_MIN * 60 * 1000;
  const late = startsAt.getTime() + MARK_DONE_LATE_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() >= early && now.getTime() <= late;
}

/** #204 cancel rule: outside the window → cancelled (slot reopens); inside → late_cancel. */
export function cancelActionFor(startsAt: Date, now: Date): "cancelled" | "late_cancel" {
  const cutoff = startsAt.getTime() - CANCEL_WINDOW_HOURS * 60 * 60 * 1000;
  return now.getTime() < cutoff ? "cancelled" : "late_cancel";
}

/** #204: a lesson request auto-expires if the tutor never confirms within 12 hours. */
export function isRequestExpired(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() >= REQUEST_EXPIRY_HOURS * 60 * 60 * 1000;
}

/**
 * #204 buffer check: reject a new lesson when it overlaps a live lesson, or
 * when both are F2F and the gap is inside the 30-minute buffer. `bufferExempt`
 * (admin override, one lesson, with reason in audit) skips the buffer but not
 * the hard overlap.
 */
export function conflictsWithLesson(
  candidate: { startsAt: Date; durationMin: number; mode: "f2f" | "online"; bufferExempt?: boolean },
  existing: { startsAt: Date; durationMin: number; mode: "f2f" | "online" },
): boolean {
  const cStart = candidate.startsAt.getTime();
  const cEnd = cStart + candidate.durationMin * 60 * 1000;
  const eStart = existing.startsAt.getTime();
  const eEnd = eStart + existing.durationMin * 60 * 1000;

  const bufferMs = candidate.bufferExempt || candidate.mode === "online" || existing.mode === "online"
    ? 0
    : F2F_BUFFER_MIN * 60 * 1000;
  return cStart < eEnd + bufferMs && eStart < cEnd + bufferMs;
}

/**
 * #204 active-student rule: an active case has a lesson done in the last 30
 * days or a future confirmed/planned lesson.
 */
export function isActiveStudentCase(
  lessons: { startsAt: Date; status: LessonStatus }[],
  now: Date,
): boolean {
  const windowMs = ACTIVE_STUDENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return lessons.some((l) => {
    if (l.status === "done") {
      return now.getTime() - l.startsAt.getTime() <= windowMs && l.startsAt.getTime() <= now.getTime();
    }
    if (l.status === "planned" || l.status === "confirmed") {
      return l.startsAt.getTime() >= now.getTime();
    }
    return false;
  });
}

// ---------------------------------------------------------------------------
// HKT helpers (#204 edge case: store UTC, compute and display Asia/Hong_Kong)
// ---------------------------------------------------------------------------

/** HKT is UTC+8 with no DST — fixed offset is exact. */
export const HKT_OFFSET_MIN = 8 * 60;

/** Minutes-from-midnight in HKT for a timestamp (0–1439). */
export function hktMinuteOfDay(d: Date): number {
  const shifted = new Date(d.getTime() + HKT_OFFSET_MIN * 60 * 1000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

/** Calendar date (YYYY-MM-DD) the timestamp falls on, in HKT. */
export function hktDateKey(d: Date): string {
  const shifted = new Date(d.getTime() + HKT_OFFSET_MIN * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

/** Weekday index (0 = Monday) of the HKT calendar day for a timestamp. */
export function hktWeekdayIndex(d: Date): number {
  const shifted = new Date(d.getTime() + HKT_OFFSET_MIN * 60 * 1000);
  return (shifted.getUTCDay() + 6) % 7;
}

/** Build a UTC Date from an HKT calendar date + minutes-from-midnight. */
export function hktFromParts(dateKey: string, minuteOfDay: number): Date {
  const utcNoon = Date.parse(`${dateKey}T00:00:00Z`);
  return new Date(utcNoon - HKT_OFFSET_MIN * 60 * 1000 + minuteOfDay * 60 * 1000);
}

/** The exact moment the day-before reminder fires: previous HKT day, 18:00 HKT. */
export function reminderDueAt(startsAt: Date): Date {
  const dayBeforeKey = hktDateKey(new Date(startsAt.getTime() - 24 * 60 * 60 * 1000));
  return hktFromParts(dayBeforeKey, 18 * 60);
}

/**
 * #204: lesson.reminder_due fires the day before at 18:00 HKT. Due from that
 * moment until the lesson starts.
 */
export function isReminderDue(startsAt: Date, now: Date): boolean {
  return now.getTime() >= reminderDueAt(startsAt).getTime() && now.getTime() < startsAt.getTime();
}
