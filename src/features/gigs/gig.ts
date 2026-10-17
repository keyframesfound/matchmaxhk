/**
 * Issues #326/#327/#328/#329 (+ reshaped #316): pure helpers for freestyle
 * gig listings and their service fulfillment orders. Freestyle = service
 * products riding the notes marketplace rails (digital_materials +
 * material_orders), so lifecycle/status/slug/money helpers are IMPORTED
 * from features/materials/lifecycle, not duplicated.
 *
 * Everything here is free of Supabase / TanStack imports so the vitest
 * suite can exercise the validation and state machine directly (see
 * tests/gigs/gig.test.ts, following tests/materials/* precedent).
 */

import { MAX_PDF_BYTES, splitMaterialMoney } from "../materials/lifecycle";
import { contactFilterError } from "@/lib/contact-filter";

/** #327: the four-category taxonomy. No syllabus tree. */
export const GIG_CATEGORIES = [
  "document_review",
  "speaking_mock",
  "workshop_package",
  "other",
] as const;
export type GigCategory = (typeof GIG_CATEGORIES)[number];

/** #326: how the tutor fulfills a paid gig. */
export const GIG_DELIVERY_TYPES = ["file_back", "session_confirm", "package_handoff"] as const;
export type GigDeliveryType = (typeof GIG_DELIVERY_TYPES)[number];

/** Turnaround presets backing the machine-readable fail-safe clock (#328). */
export const TURNAROUND_PRESETS = [
  { hours: 24 },
  { hours: 48 },
  { hours: 72 },
  { hours: 168 },
] as const;

/** #328: "within 48 hours of paid if none stated". */
export const DEFAULT_TURNAROUND_HOURS = 48;
/** #328: grace window on top of the turnaround before past_due. */
export const PAST_DUE_GRACE_HOURS = 24;

export const GIG_TITLE_MAX_LEN = 80;
export const GIG_DESCRIPTION_MAX_LEN = 2000;
export const GIG_COMPLETION_NOTE_MAX_LEN = 300;
export const GIG_TURNAROUND_NOTE_MAX_LEN = 40;

/**
 * #326: "whole HKD, minimum floor same spirit as notes… HK$0 only if
 * product later allows free gigs; default no for freestyle v1." Notes
 * dropped their floor (#314 allows free packs); freestyle keeps >0.
 */
export const GIG_MIN_PRICE_HKD = 1;

/** #326/#328 file caps. Workers body limits win over the issue's 40MB. */
export const MAX_GIG_FILE_BYTES = MAX_PDF_BYTES;

/** i18n label keys live under gigs.category_* / gigs.delivery_* . */
export function gigCategoryLabelKey(category: string): string {
  return `gigs.category_${category}`;
}

export function gigDeliveryLabelKey(deliveryType: string): string {
  return `gigs.delivery_${deliveryType}`;
}

export type GigSubmitInput = {
  title?: string | null;
  description?: string | null;
  priceHkd?: number | null;
  category?: string | null;
  deliveryType?: string | null;
  turnaroundNote?: string | null;
  turnaroundHours?: number | null;
  hasCover: boolean;
  integrityConfirmed?: boolean | null;
  curriculum?: string | null;
  subject?: string | null;
};

/**
 * #326 submit gate: title ≤80, description ≤2000, whole-HKD price ≥ floor,
 * category + delivery type required, cover required before pending_review,
 * and the document_review integrity checkbox is mandatory. Returns
 * human-readable problems — empty array means clean.
 */
export function validateGigForSubmit(input: GigSubmitInput): string[] {
  const errors: string[] = [];

  const title = (input.title ?? "").trim();
  if (title.length < 3) errors.push("Title is required (at least 3 characters).");
  else if (title.length > GIG_TITLE_MAX_LEN) {
    errors.push(`Title must be ${GIG_TITLE_MAX_LEN} characters or fewer.`);
  }

  const description = (input.description ?? "").trim();
  if (description.length === 0) errors.push("Description is required.");
  else if (description.length > GIG_DESCRIPTION_MAX_LEN) {
    errors.push(`Description must be ${GIG_DESCRIPTION_MAX_LEN} characters or fewer.`);
  }

  const price = input.priceHkd;
  if (
    price == null ||
    Number.isNaN(price) ||
    !Number.isInteger(price) ||
    price < GIG_MIN_PRICE_HKD
  ) {
    errors.push(`Price must be a whole HK$ amount of at least HK$${GIG_MIN_PRICE_HKD}.`);
  }

  const category = (input.category ?? "").trim();
  if (!(GIG_CATEGORIES as readonly string[]).includes(category)) {
    errors.push("Category must be document review, speaking/mock, workshop/package, or other.");
  }

  const deliveryType = (input.deliveryType ?? "").trim();
  if (!(GIG_DELIVERY_TYPES as readonly string[]).includes(deliveryType)) {
    errors.push("Delivery type must be file return, session confirm, or package handoff.");
  }

  if (!input.hasCover) errors.push("A cover image is required before submitting for review.");

  const turnaroundNote = (input.turnaroundNote ?? "").trim();
  if (turnaroundNote.length > GIG_TURNAROUND_NOTE_MAX_LEN) {
    errors.push(`Turnaround must be ${GIG_TURNAROUND_NOTE_MAX_LEN} characters or fewer.`);
  }

  if (
    input.turnaroundHours != null &&
    (!Number.isInteger(input.turnaroundHours) ||
      input.turnaroundHours < 1 ||
      input.turnaroundHours > 336)
  ) {
    errors.push("Turnaround hours must be between 1 and 336.");
  }

  if (category === "document_review" && input.integrityConfirmed !== true) {
    errors.push(
      "Document review listings need the academic-integrity confirmation before submitting.",
    );
  }

  return errors;
}

/** Soft validation for partial draft saves: enum membership + caps only. */
export function validateGigPartial(input: {
  title?: string | null;
  description?: string | null;
  priceHkd?: number | null;
  category?: string | null;
  deliveryType?: string | null;
  turnaroundNote?: string | null;
  turnaroundHours?: number | null;
}): string[] {
  const errors: string[] = [];

  if (input.title != null && input.title.trim().length > GIG_TITLE_MAX_LEN) {
    errors.push(`Title must be ${GIG_TITLE_MAX_LEN} characters or fewer.`);
  }
  if (input.description != null && input.description.trim().length > GIG_DESCRIPTION_MAX_LEN) {
    errors.push(`Description must be ${GIG_DESCRIPTION_MAX_LEN} characters or fewer.`);
  }
  if (
    input.priceHkd != null &&
    (Number.isNaN(input.priceHkd) || !Number.isInteger(input.priceHkd) || input.priceHkd < 0)
  ) {
    errors.push("Price must be a whole HK$ amount.");
  }
  if (
    input.category != null &&
    input.category.trim() &&
    !(GIG_CATEGORIES as readonly string[]).includes(input.category.trim())
  ) {
    errors.push("Category must be document review, speaking/mock, workshop/package, or other.");
  }
  if (
    input.deliveryType != null &&
    input.deliveryType.trim() &&
    !(GIG_DELIVERY_TYPES as readonly string[]).includes(input.deliveryType.trim())
  ) {
    errors.push("Delivery type must be file return, session confirm, or package handoff.");
  }
  if (
    input.turnaroundNote != null &&
    input.turnaroundNote.trim().length > GIG_TURNAROUND_NOTE_MAX_LEN
  ) {
    errors.push(`Turnaround must be ${GIG_TURNAROUND_NOTE_MAX_LEN} characters or fewer.`);
  }
  if (
    input.turnaroundHours != null &&
    (!Number.isInteger(input.turnaroundHours) ||
      input.turnaroundHours < 1 ||
      input.turnaroundHours > 336)
  ) {
    errors.push("Turnaround hours must be between 1 and 336.");
  }

  return errors;
}

/**
 * #326/#316 integrity: document_review listings carry the confirmed
 * timestamp from submit time on. Swapping category away from
 * document_review clears it (no stale confirmations, mirroring how
 * mergeNoteKinds drops exemplar-only fields).
 */
export function mergeGigIntegrity(
  input: {
    category?: string | null;
    integrityConfirmed?: boolean | null;
  },
  existing?: {
    category?: string | null;
    integrityConfirmedAt?: string | null;
  },
): { category: string; integrityConfirmedAt: string | null } {
  const category =
    input.category != null && (GIG_CATEGORIES as readonly string[]).includes(input.category.trim())
      ? input.category.trim()
      : (existing?.category ?? "");
  if (category !== "document_review") {
    return { category, integrityConfirmedAt: null };
  }
  // Explicit-clear semantics (mirrors mergeNoteKinds): true confirms
  // (keeping an existing timestamp), false withdraws, undefined keeps.
  let integrityConfirmedAt: string | null;
  if (input.integrityConfirmed === false) {
    integrityConfirmedAt = null;
  } else if (input.integrityConfirmed === true) {
    integrityConfirmedAt = existing?.integrityConfirmedAt ?? new Date().toISOString();
  } else {
    integrityConfirmedAt = existing?.integrityConfirmedAt ?? null;
  }
  return { category, integrityConfirmedAt };
}

/**
 * #326 staff-review hint (NOT an auto-reject): seat-scarcity / recruiting
 * copy is a reject-to-draft reason staff apply with a written reason, but
 * surfacing the flag in the review queue keeps the rule cheap to enforce.
 */
const INTEGRITY_RED_FLAG_PATTERNS: RegExp[] = [
  /\bseats?\s+(left|remaining|available)\b/i,
  /\blimited\s+seats?\b/i,
  /\benrol{1,2}(ment)?\s+(closes|deadline|ends)\b/i,
  /\bhiring\s+tutors?\b/i,
  /\bwe['’]?re\s+(looking\s+for|recruiting)\s+tutors?\b/i,
  /(學位名額有限|招生中|招募導師)/,
  /\bi['’]?ll\s+(write|rewrite|do)\s+your\s+(ia|ee|tok|essay)\b/i,
  /\bguaranteed\s+grade\b/i,
];

/** Returns the matched flag descriptions (empty = clean). */
export function findIntegrityRedFlags(text: string): string[] {
  if (!text) return [];
  return INTEGRITY_RED_FLAG_PATTERNS.filter((pattern) => pattern.test(text)).map(
    (pattern) => pattern.source,
  );
}

/**
 * #328: ghosting fail-safe clock. fulfillment_due_at = paid_at + stated
 * turnaround (or the 48h default); past_due = due + 24h grace.
 */
export function gigFulfillmentDueAt(paidAt: Date, turnaroundHours?: number | null): Date {
  const hours =
    turnaroundHours != null && Number.isInteger(turnaroundHours) && turnaroundHours >= 1
      ? turnaroundHours
      : DEFAULT_TURNAROUND_HOURS;
  return new Date(paidAt.getTime() + hours * 60 * 60 * 1000);
}

export function gigPastDueCutoff(fulfillmentDueAt: Date): Date {
  return new Date(fulfillmentDueAt.getTime() + PAST_DUE_GRACE_HOURS * 60 * 60 * 1000);
}

/**
 * #328 gig-order states and transitions. 'paid'/'stamping'/'stamp_failed'
 * stay notes-only (instant code); a gig jumps to in_fulfillment the moment
 * staff confirm the FPS payment.
 */
export const GIG_ORDER_STATUSES = [
  "awaiting_payment",
  "in_fulfillment",
  "past_due",
  "delivered",
  "rejected",
  "refunded",
] as const;
export type GigOrderStatus = (typeof GIG_ORDER_STATUSES)[number];

export type GigOrderAction =
  | "mark_paid" // staff confirm FPS: awaiting_payment -> in_fulfillment
  | "reject_payment" // staff: awaiting_payment -> rejected
  | "deliver" // tutor fulfills (file return / completion mark): -> delivered
  | "sweep_past_due" // system clock: in_fulfillment -> past_due
  | "request_refund" // parent self-serve from past_due: -> refunded
  | "staff_refund"; // staff refund at any pre-refunded stage

/** Returns the next status for a gig order action, or null when illegal. */
export function transitionGigOrder(current: string, action: GigOrderAction): GigOrderStatus | null {
  switch (action) {
    case "mark_paid":
      return current === "awaiting_payment" ? "in_fulfillment" : null;
    case "reject_payment":
      return current === "awaiting_payment" ? "rejected" : null;
    case "deliver":
      return current === "in_fulfillment" || current === "past_due" ? "delivered" : null;
    case "sweep_past_due":
      return current === "in_fulfillment" ? "past_due" : null;
    case "request_refund":
      return current === "past_due" ? "refunded" : null;
    case "staff_refund":
      return current === "awaiting_payment" ||
        current === "in_fulfillment" ||
        current === "past_due" ||
        current === "delivered"
        ? "refunded"
        : null;
    default:
      return null;
  }
}

/** #328: the parent's self-serve refund control shows on past_due only. */
export function canParentRequestRefund(status: string): boolean {
  return status === "past_due";
}

/** Buyer-facing action for an order row on the orders page. */
export function gigOrderBuyerAction(
  status: string,
): "pay" | "awaiting_delivery" | "request_refund" | "download" | "refunded" {
  if (status === "awaiting_payment" || status === "rejected") return "pay";
  if (status === "in_fulfillment") return "awaiting_delivery";
  if (status === "past_due") return "request_refund";
  if (status === "delivered") return "download";
  return "refunded";
}

/**
 * #328: completion notes (session_confirm / package_handoff) are capped at
 * 300 chars AND always run the contact filter — a note that fails stays
 * rejected and the order remains in_fulfillment.
 */
export function validateCompletionNote(note: string | null | undefined): string[] {
  const errors: string[] = [];
  const text = (note ?? "").trim();
  if (text.length > GIG_COMPLETION_NOTE_MAX_LEN) {
    errors.push(`Completion note must be ${GIG_COMPLETION_NOTE_MAX_LEN} characters or fewer.`);
  }
  if (text) {
    const contactProblem = contactFilterError(text);
    if (contactProblem) errors.push(contactProblem);
  }
  return errors;
}

/**
 * #328 gig timeline: awaiting_payment → in_fulfillment → delivered. Pure so
 * the vitest suite can pin the shape; keys are FULL i18n keys (mixed
 * orders.* / gigs.*) because the shared render prints t(step.key).
 */
export function gigTimelineSteps(
  status: string,
): { key: string; done: boolean; current: boolean }[] {
  const closed = ["delivered", "refunded"].includes(status);
  return [
    {
      key: "orders.step_awaiting_payment",
      done: !["awaiting_payment", "rejected"].includes(status),
      current: status === "awaiting_payment",
    },
    {
      key: "gigs.step_in_fulfillment",
      done: closed,
      current: status === "in_fulfillment" || status === "past_due",
    },
    { key: "orders.step_delivered", done: status === "delivered", current: false },
  ];
}

/** Money: identical 20% platform fee model as notes (#328). */
export function splitGigMoney(grossHkd: number): {
  platformFeeHkd: number;
  tutorNetHkd: number;
} {
  return splitMaterialMoney(grossHkd);
}

/** #329: delivered orders ONLY count toward the public bought figure. */
export function countsTowardBoughtCount(orderStatus: string): boolean {
  return orderStatus === "delivered";
}
