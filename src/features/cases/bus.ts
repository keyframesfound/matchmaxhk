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
  "case.match_waves_exhausted",
  "case.demand_side_updated",
  "lesson.done",
  "lesson.reminder_due",
  "admin_fee.invoiced",
  "admin_fee.unpaid",
  "note_order.delivered",
  "review.published",
  // #461 addendum Triggers 8-9: bilateral lesson cancel + schedule/
  // reschedule. Actor-split event types so only the OTHER party is messaged.
  "lesson.cancelled_by_parent",
  "lesson.cancelled_by_tutor",
  "lesson.scheduled_by_parent",
  "lesson.scheduled_by_tutor",
  // #654 reschedule answers and shared statements, for the other side only.
  "billing.notice_by_parent",
  "billing.notice_by_tutor",
  // #542 V1 triggers 1/2/4/6/7 + #561 Action Required scenarios. The
  // action-required half is decided by ACTION_PLAN (action-required.ts);
  // these entries only control recipients, channels and mode context.
  "case.lead_new",
  "case.match_alert",
  "case.already_taken",
  "intro.shared_parent",
  "intro.shared_tutor",
  "verification.approved",
  "verification.rejected",
  "material.rejected",
  "content.rejected",
  "report.filed",
  "action.profile_fields",
  "action.onboarding",
  "action.admin_task",
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
  "case.match_waves_exhausted",
  "case.demand_side_updated",
  "note_order.delivered",
  "review.published",
  "admin_fee.invoiced",
  "admin_fee.unpaid",
  "lesson.reminder_due",
  "lesson.review_prompt",
  "experience.session_logged",
  // #503 soft prompt after one side taps End Case.
  "case.end_requested_by_parent",
  "case.end_requested_by_tutor",
  // #461 addendum Triggers 8-9: lesson lifecycle changes reach the
  // counterparty (the actor-side variant never reaches the actor).
  "lesson.cancelled_by_parent",
  "lesson.cancelled_by_tutor",
  "lesson.scheduled_by_parent",
  "lesson.scheduled_by_tutor",
  // #654 reschedule answers and shared statements, for the other side only.
  "billing.notice_by_parent",
  "billing.notice_by_tutor",
  // #542 V1 triggers + #561 action items reach the bell. report.filed is
  // bell-visible for the reported owner (anonymous by design — the payload
  // never carries the reporter identity).
  "case.lead_new",
  "case.match_alert",
  "case.already_taken",
  "intro.shared_parent",
  "intro.shared_tutor",
  "verification.approved",
  "verification.rejected",
  "material.rejected",
  "content.rejected",
  "report.filed",
  "action.profile_fields",
  "action.onboarding",
  "action.admin_task",
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

/** `recipient`: the event payload names its single account directly (#561). */
export type BusRole = "parent" | "tutor" | "concierge" | "recipient";
export type BusChannel = "in_app" | "email";

/**
 * #542 mode context stamped on every delivery row. The bell filters by the
 * user's active mode (parent = Learning, tutor = Teaching); `system` items
 * (moderation, admin tasks) are always visible in both modes.
 */
export type BusContext = "learning" | "teaching" | "system";

/** Events delivered straight to a payload-named account (role `recipient`). */
const RECIPIENT_ROLE_EVENTS: readonly string[] = [
  "report.filed",
  "content.rejected",
  "action.profile_fields",
  "action.onboarding",
  "action.admin_task",
];

/**
 * #542: mode context for one delivery. Case/class events follow the
 * recipient's side (parent → Learning, tutor → Teaching, concierge → system);
 * payload-addressed events carry their context in `payload.context`
 * (moderation flows use `system` so they stay visible in both modes).
 */
export function resolveDeliveryContext(
  eventType: string,
  role: BusRole | "recipient",
  payload: Record<string, unknown>,
): BusContext {
  if (RECIPIENT_ROLE_EVENTS.includes(eventType) || role === "recipient") {
    const ctx = payload.context;
    return ctx === "learning" || ctx === "teaching" ? ctx : "system";
  }
  if (role === "tutor") return "teaching";
  if (role === "parent") return "learning";
  return "system";
}

/**
 * #542 preference gate for the email channel (in-app is never gated). Keys
 * mirror profiles.notification_preferences; `moderation` is always-on and
 * only listed so rejection/report mail respects nothing but the send itself.
 * Per-recipient: the materials buyer is a Learning purchase confirm
 * (`case_updates`), the seller a Teaching sale (`tutor_leads`).
 */
export function prefsKeyForEmail(
  eventType: string,
  payload: Record<string, unknown>,
  recipientAccountId: string,
): "case_updates" | "tutor_leads" | "case_match_alerts" | "moderation" {
  if (eventType === "case.match_alert") return "case_match_alerts";
  if (eventType === "case.already_taken") return "tutor_leads";
  if (eventType === "case.lead_new" || eventType === "intro.shared_tutor") return "tutor_leads";
  if (eventType === "verification.approved" || eventType === "verification.rejected")
    return "tutor_leads";
  if (eventType === "material.rejected") return "tutor_leads";
  if (eventType === "content.rejected" || eventType === "report.filed") return "moderation";
  if (eventType === "note_order.delivered") {
    return payload.buyer_account_id === recipientAccountId ? "case_updates" : "tutor_leads";
  }
  return "case_updates";
}

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
  // #657 ranked waves: the tutor gets the bell and an email; the desk only the bell.
  "case.match_alert": [
    { channel: "in_app", role: "tutor" },
    { channel: "email", role: "tutor" },
  ],
  "case.already_taken": [
    { channel: "in_app", role: "tutor" },
    { channel: "email", role: "tutor" },
  ],
  "case.match_waves_exhausted": [{ channel: "in_app", role: "concierge" }],
  // #637: bell only; the notes themselves stay on the case page.
  "case.demand_side_updated": [{ channel: "in_app", role: "tutor" }],
  "lesson.review_prompt": [{ channel: "in_app", role: "parent" }],
  "lesson.reminder_due": [
    { channel: "in_app", role: "parent" },
    { channel: "in_app", role: "tutor" },
  ],
  // #259 / #444 tutor-pays: the payer of the admin fee is the matched tutor,
  // so invoice + due-date reminders reach the tutor, never the parent.
  "admin_fee.invoiced": [{ channel: "in_app", role: "tutor" }],
  "admin_fee.unpaid": [
    { channel: "in_app", role: "tutor" },
    { channel: "email", role: "tutor" },
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
  // #503 soft prompt: one side tapped End Case. Two event types (one per
  // actor) so the delivery plan reaches only the OTHER party — the actor
  // already knows they tapped.
  "case.end_requested_by_parent": [{ channel: "in_app", role: "tutor" }],
  "case.end_requested_by_tutor": [{ channel: "in_app", role: "parent" }],
  // #461 addendum Triggers 8-9: counterparty gets the bell plus the email
  // (case_updates class — a schedule/cancel change is email-worthy).
  "lesson.cancelled_by_parent": [
    { channel: "in_app", role: "tutor" },
    { channel: "email", role: "tutor" },
  ],
  "lesson.cancelled_by_tutor": [
    { channel: "in_app", role: "parent" },
    { channel: "email", role: "parent" },
  ],
  "lesson.scheduled_by_parent": [
    { channel: "in_app", role: "tutor" },
    { channel: "email", role: "tutor" },
  ],
  "lesson.scheduled_by_tutor": [
    { channel: "in_app", role: "parent" },
    { channel: "email", role: "parent" },
  ],
  "billing.notice_by_parent": [
    { channel: "in_app", role: "tutor" },
    { channel: "email", role: "tutor" },
  ],
  "billing.notice_by_tutor": [
    { channel: "in_app", role: "parent" },
    { channel: "email", role: "parent" },
  ],
  // Concierge unpaid-fee digest (#205). Generated at most once per 24h by the
  // drain; not a bell item for parents/tutors.
  "admin_fee.digest": [
    { channel: "in_app", role: "concierge" },
    { channel: "email", role: "concierge" },
  ],
  // ---- #542 V1 triggers + #561 Action Required scenarios -------------------
  // Trigger 1 / AR-2: a case is matched to a tutor — a lead to claim.
  "case.lead_new": [
    { channel: "in_app", role: "tutor" },
    { channel: "email", role: "tutor" },
  ],
  // Trigger 2 / AR-3: admin marked the fee paid and contact is shared.
  "intro.shared_parent": [
    { channel: "in_app", role: "parent" },
    { channel: "email", role: "parent" },
  ],
  "intro.shared_tutor": [
    { channel: "in_app", role: "tutor" },
    { channel: "email", role: "tutor" },
  ],
  // Trigger 4: Blue Tick review outcome.
  "verification.approved": [
    { channel: "in_app", role: "tutor" },
    { channel: "email", role: "tutor" },
  ],
  "verification.rejected": [
    { channel: "in_app", role: "tutor" },
    { channel: "email", role: "tutor" },
  ],
  // Trigger 6 / AR-7: admin rejected a submitted listing (materials first).
  "material.rejected": [
    { channel: "in_app", role: "tutor" },
    { channel: "email", role: "tutor" },
  ],
  // Trigger 6 (generic submitter) + Trigger 7 (reported owner, anonymous):
  // moderation mail is preference-gated on the always-on `moderation` key.
  "content.rejected": [
    { channel: "in_app", role: "recipient" },
    { channel: "email", role: "recipient" },
  ],
  "report.filed": [
    { channel: "in_app", role: "recipient" },
    { channel: "email", role: "recipient" },
  ],
  // AR-4 / AR-10 daily scans + AR-5 admin-appointed tasks: recipient-addressed.
  "action.profile_fields": [
    { channel: "in_app", role: "recipient" },
    { channel: "email", role: "recipient" },
  ],
  "action.onboarding": [
    { channel: "in_app", role: "recipient" },
    { channel: "email", role: "recipient" },
  ],
  "action.admin_task": [
    { channel: "in_app", role: "recipient" },
    { channel: "email", role: "recipient" },
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
    // #503 soft prompt: the recipient lands where their End Case control
    // lives (tutor Schedule hub / parent case page).
    case "case.end_requested_by_parent":
    case "case.end_requested_by_tutor":
      if (role === "tutor") return tutorHome;
      return caseId ? `/account/cases/${caseId}` : "/account";
    case "lesson.reminder_due":
      if (role === "tutor") return tutorHome;
      return caseId ? `/account/cases/${caseId}` : "/account";
    // #461 addendum Triggers 8-9: same split as reminders — the tutor's
    // lessons surface vs the parent's case page.
    case "lesson.cancelled_by_parent":
    case "lesson.cancelled_by_tutor":
    case "lesson.scheduled_by_parent":
    case "lesson.scheduled_by_tutor":
      if (role === "tutor") return tutorHome;
      return caseId ? `/account/cases/${caseId}` : "/account";
    case "billing.notice_by_parent":
    case "billing.notice_by_tutor": {
      // #654: straight to the tab where the recipient can act.
      const code = typeof payload.case_code === "string" ? payload.case_code : null;
      return code ? `/calendar?case=${encodeURIComponent(code)}&tab=schedule` : "/calendar";
    }
    case "admin_fee.invoiced":
    case "admin_fee.unpaid":
      // #259: the payer (tutor) settles on their case card.
      return tutorHome;
    case "experience.session_logged":
      return caseId ? `/account/cases/${caseId}` : "/account";
    // #542 V1 triggers + #561 action items. Payload-deep links win when the
    // emitter or the admin tool supplied one (admin free-form tasks land on
    // any route the admin picked).
    case "case.match_alert":
      return typeof payload.link === "string" && payload.link.startsWith("/")
        ? payload.link
        : "/tutor-requests";
    case "case.already_taken":
      return "/tutor-requests";
    case "case.match_waves_exhausted":
      return caseId ? `/admin/cases?case=${caseId}` : "/admin/cases";
    case "case.demand_side_updated":
      return tutorHome;
    case "case.lead_new":
    case "intro.shared_tutor":
      if (role === "tutor") return tutorHome;
      return caseId ? `/account/cases/${caseId}` : "/account";
    case "intro.shared_parent":
      return caseId ? `/account/cases/${caseId}` : "/account";
    case "verification.approved":
    case "verification.rejected":
    case "action.onboarding":
    case "action.profile_fields":
      return typeof payload.link === "string" && payload.link.startsWith("/")
        ? payload.link
        : "/dashboard#my-tutor";
    case "material.rejected":
    case "content.rejected":
    case "report.filed":
    case "action.admin_task":
      return typeof payload.link === "string" && payload.link.startsWith("/")
        ? payload.link
        : "/notifications";
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
