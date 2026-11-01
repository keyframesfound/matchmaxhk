/**
 * Issue #561, Action Required notifications: pure schedule + plan rules.
 *
 * An Action Required item is an in-app event_deliveries row with
 * action_required = true. It stays highlighted until the underlying action
 * completes (or is dismissed), and a locked reminder schedule sends follow-up
 * emails at most `REMINDER_OFFSETS[urgency].length` times after the initial
 * send — max 3 total sends.
 *
 * Locked cadence (issue #561 §3B):
 *   High   → immediate, +1 day, +3 days   (3 sends)
 *   Medium → immediate, +2 days, +5 days  (3 sends)
 *   Low    → immediate, +7 days           (2 sends)
 */

export type ActionUrgency = "high" | "medium" | "low";

/** Follow-up offsets after the initial send, in hours. */
export const REMINDER_OFFSETS_HOURS: Record<ActionUrgency, readonly number[]> = {
  high: [24, 72],
  medium: [48, 120],
  low: [168],
};

/** Total sends including the initial one (never exceeds 3). */
export function maxSendsFor(urgency: ActionUrgency): number {
  return REMINDER_OFFSETS_HOURS[urgency].length + 1;
}

export type ActionPlan = {
  action_type: string;
  urgency: ActionUrgency;
  /** i18n key of the primary CTA (client renders it on the pinned item). */
  cta_key: string;
  /** Entity the action is about (case id, tutor id, …) for completion hooks. */
  entity_from: "case_id" | "tutor_id" | "material_id" | "recipient" | "none";
  /** Low-urgency items may be dismissed by the user ("Not now"). */
  user_dismissable: boolean;
  /** Admin-appointed tasks resolve via an explicit "Mark complete" button. */
  user_completable: boolean;
};

/**
 * Per-event-type action metadata. Only rows planned through DELIVERY_PLAN
 * with an entry here become Action Required items; plain informational
 * triggers keep their current shape.
 */
export const ACTION_PLAN: Readonly<Record<string, ActionPlan>> = {
  // AR-1 (also #542 Trigger 4B): admin rejected a verification document.
  "verification.rejected": {
    action_type: "verify_reupload",
    urgency: "high",
    cta_key: "sor.ar_cta_reupload",
    entity_from: "tutor_id",
    user_dismissable: false,
    user_completable: false,
  },
  // (verification.approved is informational only — #542 Trigger 4A; the
  // completion hook clears any open verify_reupload instead.)
  // AR-2 (also #542 Trigger 1): new case lead dispatched to a tutor.
  "case.lead_new": {
    action_type: "lead_respond",
    urgency: "medium",
    cta_key: "sor.ar_cta_view_lead",
    entity_from: "case_id",
    user_dismissable: false,
    user_completable: false,
  },
  // AR-3 (also #542 Trigger 2): contact shared — confirm + arrange Lesson 1.
  "intro.shared_parent": {
    action_type: "intro_confirm",
    urgency: "medium",
    cta_key: "sor.ar_cta_open_case",
    entity_from: "case_id",
    user_dismissable: false,
    user_completable: false,
  },
  "intro.shared_tutor": {
    action_type: "intro_confirm",
    urgency: "medium",
    cta_key: "sor.ar_cta_open_case",
    entity_from: "case_id",
    user_dismissable: false,
    user_completable: false,
  },
  // AR-11 (also #542 Trigger 8): counterparty cancelled — propose/confirm a
  // new time. Resolved when the next lesson on the case is scheduled.
  "lesson.cancelled_by_parent": {
    action_type: "lesson_reschedule",
    urgency: "medium",
    cta_key: "sor.ar_cta_open_case",
    entity_from: "case_id",
    user_dismissable: false,
    user_completable: false,
  },
  "lesson.cancelled_by_tutor": {
    action_type: "lesson_reschedule",
    urgency: "medium",
    cta_key: "sor.ar_cta_open_case",
    entity_from: "case_id",
    user_dismissable: false,
    user_completable: false,
  },
  // AR-7: admin rejected a materials listing — edit + resubmit.
  "material.rejected": {
    action_type: "materials_fix",
    urgency: "medium",
    cta_key: "sor.ar_cta_fix_material",
    entity_from: "material_id",
    user_dismissable: false,
    user_completable: false,
  },
  // AR-4: system detected missing critical profile fields (daily scan).
  "action.profile_fields": {
    action_type: "profile_fields",
    urgency: "medium",
    cta_key: "sor.ar_cta_account",
    entity_from: "recipient",
    user_dismissable: true,
    user_completable: false,
  },
  // AR-10: new tutor onboarding checklist incomplete (daily scan).
  "action.onboarding": {
    action_type: "onboarding",
    urgency: "low",
    cta_key: "sor.ar_cta_onboarding",
    entity_from: "recipient",
    user_dismissable: true,
    user_completable: false,
  },
  // AR-5: admin-appointed free-form task.
  "action.admin_task": {
    action_type: "admin_task",
    urgency: "medium",
    cta_key: "sor.ar_cta_mark_complete",
    entity_from: "recipient",
    user_dismissable: true,
    user_completable: true,
  },
};

/** First reminder is due this many hours after the initial delivery. */
export function firstReminderAt(urgency: ActionUrgency, from: Date): Date {
  return new Date(from.getTime() + REMINDER_OFFSETS_HOURS[urgency][0] * 3600_000);
}

export function reminderAt(urgency: ActionUrgency, reminderCount: number, from: Date): Date | null {
  const offset = REMINDER_OFFSETS_HOURS[urgency][reminderCount];
  return offset === undefined ? null : new Date(from.getTime() + offset * 3600_000);
}

export type DueReminderRow = {
  action_urgency: string | null;
  action_reminder_count: number;
  action_next_reminder_at: string | null;
  action_expires_at: string | null;
};

/**
 * Should the reminder sweep send a follow-up for this open action now?
 * The sweep runs daily (09:00 HKT cron); laziness safety: only rows whose
 * next_reminder_at has passed are eligible, and expiry stops everything.
 */
export function shouldSendReminder(row: DueReminderRow, now: Date): boolean {
  if (
    row.action_urgency !== "high" &&
    row.action_urgency !== "medium" &&
    row.action_urgency !== "low"
  )
    return false;
  if (row.action_next_reminder_at === null) return false;
  if (Date.parse(row.action_next_reminder_at) > now.getTime()) return false;
  if (row.action_expires_at && Date.parse(row.action_expires_at) <= now.getTime()) return false;
  return row.action_reminder_count < REMINDER_OFFSETS_HOURS[row.action_urgency].length;
}
