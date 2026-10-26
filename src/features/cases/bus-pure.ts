/**
 * Issues #205 + #292, pure planning helpers for the lazy notification drain.
 *
 * The drain (bus.functions.ts) runs on bell reads / event-producing writes —
 * this repo has no cron. Everything decidable without a DB round-trip lives
 * here so the vitest suite can pin the timing rules:
 *  - lesson.reminder_due: previous HKT day at 18:00 HKT, once per lesson
 *  - lesson.review_prompt: 2h after lesson.done, once per lesson, only when
 *    no review exists for that lesson
 *  - admin_fee.unpaid: parent reminder on day 3 and day 7 after invoice
 *  - concierge digest: at most one per 24h
 */

import { REVIEW_PROMPT_DELAY_MS } from "@/features/cases/bus";
import { isReminderDue } from "@/features/cases/sor";

/** Dedupe key used in case_events lookups: `${event_type}:${source_id}`. */
export function eventKey(eventType: string, sourceId: string | null): string {
  return `${eventType}:${sourceId ?? "null"}`;
}

export type ReminderLesson = {
  id: string;
  starts_at: string;
  status: string;
};

/** A pending request/confirmed lesson gets ONE day-before reminder (#204). */
export function shouldCreateReminder(
  lesson: ReminderLesson,
  now: Date,
  existingEventKeys: ReadonlySet<string>,
): boolean {
  if (lesson.status !== "planned" && lesson.status !== "confirmed") return false;
  const startsAt = new Date(lesson.starts_at);
  if (!isReminderDue(startsAt, now)) return false;
  return !existingEventKeys.has(eventKey("lesson.reminder_due", lesson.id));
}

export type DoneEvent = {
  id: string;
  payload: Record<string, unknown>;
  created_at: string;
};

/**
 * #205: "Marking done creates one prompt, not one per refresh." The prompt is
 * a lesson.review_prompt event created 2h after the lesson.done event, only
 * if no review exists for that lesson yet.
 */
export function shouldCreateReviewPrompt(
  doneEvent: DoneEvent,
  now: Date,
  hasReviewForLesson: boolean,
  existingEventKeys: ReadonlySet<string>,
): boolean {
  if (doneEvent.payload?.lesson_id == null) return false;
  const createdAt = Date.parse(doneEvent.created_at);
  if (Number.isNaN(createdAt)) return false;
  if (now.getTime() - createdAt < REVIEW_PROMPT_DELAY_MS) return false;
  if (hasReviewForLesson) return false;
  const lessonId = String(doneEvent.payload.lesson_id);
  return !existingEventKeys.has(eventKey("lesson.review_prompt", lessonId));
}

export type OpenFee = {
  id: string;
  due_at: string | null;
  status: string;
};

/**
 * #205: parent reminder on day 3 and day 7 after invoice. Invoice + 3 days =
 * due date, so day 3 = now >= due_at, day 7 = now >= due_at + 4 days.
 * `lastReminderDayForCase` is the highest day already reminded ("", "3" or "7").
 */
export function shouldCreateParentFeeReminder(
  fee: OpenFee,
  now: Date,
  lastReminderDayForCase: number | null,
): { day: 3 | 7 } | null {
  if (fee.status !== "invoiced") return null;
  if (!fee.due_at) return null;
  const dueAt = Date.parse(fee.due_at);
  if (Number.isNaN(dueAt)) return null;
  if (now.getTime() < dueAt) return null;

  const day7At = dueAt + 4 * 24 * 60 * 60 * 1000;
  const day: 3 | 7 = now.getTime() >= day7At ? 7 : 3;
  if (lastReminderDayForCase !== null && lastReminderDayForCase >= day) return null;
  return { day };
}

/** Concierge unpaid digest: at most one per 24h (#205 "daily digest", lazy). */
export function shouldCreateConciergeDigest(
  unpaidCount: number,
  lastDigestAt: Date | null,
  now: Date,
): boolean {
  if (unpaidCount <= 0) return false;
  if (!lastDigestAt) return true;
  return now.getTime() - lastDigestAt.getTime() >= 24 * 60 * 60 * 1000;
}

/** Drain outcome for one pending event (mirrors planDeliveriesForEvent + delivery side). */
export type DrainAction = "deliver" | "skip" | "fail_unknown";

/** How many failed attempts are allowed before a delivery is failed for good. */
export const MAX_DELIVERY_ATTEMPTS = 3;

/** Pure retry decision for a failed email delivery. */
export function nextDeliveryStatus(
  currentAttempts: number,
  sendOk: boolean,
): "sent" | "pending" | "failed" {
  if (sendOk) return "sent";
  const attempts = currentAttempts + 1;
  return attempts >= MAX_DELIVERY_ATTEMPTS ? "failed" : "pending";
}
