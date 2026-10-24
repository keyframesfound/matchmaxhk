/**
 * Issue #205 + #292, notification bus: pure planning half.
 *
 * Events land in case_events (DB triggers + server fns); the lazy drain
 * (bus.functions.ts, called on bell reads / desk loads / event-producing
 * writes, no cron exists in this repo) plans deliveries with
 * planDeliveriesForEvent and persists them idempotently on
 * (event_id, channel, recipient). The DB unique constraint is the real
 * idempotence guarantee; this planner never produces duplicates itself.
 */

export const BUS_EVENT_TYPES = [
  "lesson.done",
  "lesson.reminder_due",
  "admin_fee.invoiced",
  "admin_fee.unpaid",
  "note_order.delivered",
  "review.published",
  // Accepted but unconsumed (#205): stored as skipped, no message.
  "listing.viewed",
  "listing.saved",
  "entitlement.granted",
] as const;

export type BusEventType = (typeof BUS_EVENT_TYPES)[number];

/** #205: known-but-unconsumed event names are recorded, never messaged. */
export const SKIPPED_EVENT_TYPES: readonly string[] = [
  "listing.viewed",
  "listing.saved",
  "entitlement.granted",
];

/** #292 events the bell surfaces. "Someone saved your note" is deliberately absent. */
export const BELL_EVENT_TYPES: readonly string[] = [
  "note_order.delivered",
  "review.published",
  "admin_fee.invoiced",
  "admin_fee.unpaid",
  "lesson.reminder_due",
  "lesson.review_prompt",
  "experience.session_logged",
];

/**
 * Review prompts are consumers of lesson.done, not trigger emissions: the
 * drain creates one lesson.review_prompt per done lesson, 2 hours after the
 * lesson, only if no review exists for that lesson yet (#205 "one prompt, not
 * one per refresh", the (event,channel,recipient) unique keeps it single).
 */
export const REVIEW_PROMPT_DELAY_MS = 2 * 60 * 60 * 1000;

/** #205: retries 3, then failed. */
export const DELIVERY_MAX_ATTEMPTS = 3;

export type BusRole = "parent" | "tutor" | "concierge";
export type BusChannel = "in_app" | "email";

/**
 * Which recipients a consumed event reaches, and on which channels.
 * Email is reserved for the important classes Ryan called out: fee due and
 * order delivered (plus the concierge unpaid digest). Everything else is
 * in-app only.
 */
export const DELIVERY_PLAN: Readonly<
  Record<string, readonly { channel: BusChannel; role: BusRole }[]>
> = {
  "lesson.done": [],
  "lesson.review_prompt": [{ channel: "in_app", role: "parent" }],
  "lesson.reminder_due": [
    { channel: "in_app", role: "parent" },
    { channel: "in_app", role: "tutor" },
  ],
  "admin_fee.invoiced": [{ channel: "in_app", role: "parent" }],
  "admin_fee.unpaid": [
    { channel: "in_app", role: "parent" },
    { channel: "email", role: "parent" },
    { channel: "email", role: "concierge" },
  ],
  "note_order.delivered": [
    { channel: "in_app", role: "tutor" },
    { channel: "in_app", role: "parent" },
    { channel: "email", role: "tutor" },
    { channel: "email", role: "parent" },
  ],
  "review.published": [{ channel: "in_app", role: "tutor" }],
  // #387 notification leg: the parent learns a session was logged (bell only
  //, lightweight by issue design; the Dispute button lives on the linked
  // case page). No email: fee/order classes are the email set.
  "experience.session_logged": [{ channel: "in_app", role: "parent" }],
  // Concierge unpaid-fee digest (#205). Generated at most once per 24h by the
  // drain; not a bell item for parents/tutors.
  "admin_fee.digest": [
    { channel: "in_app", role: "concierge" },
    { channel: "email", role: "concierge" },
  ],
};

export type PlannedDelivery = { channel: BusChannel; role: BusRole };

export type PlanResult =
  { kind: "deliver"; deliveries: PlannedDelivery[] } | { kind: "skip" } | { kind: "unknown" };

/**
 * Pure classifier for one pending event. Unknown types are stored as failed,
 * not dropped (#205); unconsumed known types are stored as skipped.
 */
export function planDeliveriesForEvent(eventType: string): PlanResult {
  if (SKIPPED_EVENT_TYPES.includes(eventType)) return { kind: "skip" };
  const plan = DELIVERY_PLAN[eventType];
  if (!plan) return { kind: "unknown" };
  if (plan.length === 0) return { kind: "skip" };
  return { kind: "deliver", deliveries: [...plan] };
}

/**
 * Deep links for bell items (#292: each item opens the related page).
 * `role` is the recipient's side: tutors land on their Lessons surface
 * (/dashboard#lessons), never on the parent-owned case route, the trigger
 * payloads carry case_id only, so the parent /account/cases/{id} link is
 * parent-only.
 */
export function bellLinkFor(
  eventType: string,
  payload: Record<string, unknown>,
  role?: BusRole | "unknown" | null,
): string | null {
  const caseId = typeof payload.case_id === "string" ? payload.case_id : null;
  const tutorHome = "/dashboard#lessons";
  switch (eventType) {
    case "note_order.delivered": {
      const orderId = typeof payload.order_id === "string" ? payload.order_id : null;
      return orderId ? `/orders/${orderId}` : "/account";
    }
    case "review.published": {
      if (role === "tutor") {
        const slug = typeof payload.tutor_slug === "string" ? payload.tutor_slug : null;
        return slug ? `/tutors/${slug}` : tutorHome;
      }
      const slug = typeof payload.tutor_slug === "string" ? payload.tutor_slug : null;
      return slug ? `/tutors/${slug}` : caseId ? `/account/cases/${caseId}` : "/account";
    }
    case "lesson.review_prompt":
      return caseId ? `/account/cases/${caseId}#review` : "/account";
    case "lesson.reminder_due":
      if (role === "tutor") return tutorHome;
      return caseId ? `/account/cases/${caseId}` : "/account";
    case "admin_fee.invoiced":
    case "admin_fee.unpaid":
    case "experience.session_logged":
      return caseId ? `/account/cases/${caseId}` : "/account";
    default:
      return null;
  }
}

/**
 * Per-recipient payload redaction (#375 Back-end blocker 3): the raw event
 * payload is shared across all recipients of an event, but tutor-side money
 * must never reach the buyer's bell. note_order.delivered carries
 * gross_hkd + tutor_net_hkd (tutor economics), strip both for parent
 * recipients; the tutor's own copy keeps them.
 */
export function redactBellPayload(
  eventType: string,
  payload: Record<string, unknown>,
  role: BusRole | "unknown",
): Record<string, unknown> {
  if (eventType === "note_order.delivered" && role === "parent") {
    const { gross_hkd: _gross, tutor_net_hkd: _net, ...safe } = payload;
    return safe;
  }
  return payload;
}
