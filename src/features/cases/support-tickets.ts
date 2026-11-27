/**
 * Issue #816 §2.3 (AC-260-1/2/3) — case support tickets, the pure half.
 *
 * A support ticket lives on ONE case: at most one open at a time, five fixed
 * reasons, and free text that must never turn the desk into a back channel.
 * The rules live here so the server fn, the desk panel and the vitest suite
 * all read the same vocabulary. No DB, no React.
 */

import { hasContactDetails } from "@/lib/contact-filter";

export const TICKET_REASONS = [
  "fee_amount",
  "no_show",
  "cannot_pay",
  "wrong_tutor",
  "other",
] as const;

export type TicketReason = (typeof TICKET_REASONS)[number];

/** English desk labels. Order matches TICKET_REASONS. */
export const TICKET_REASON_LABELS: Record<TicketReason, string> = {
  fee_amount: "Fee amount",
  no_show: "Tutor no-show",
  cannot_pay: "Cannot pay",
  wrong_tutor: "Wrong tutor",
  other: "Other",
};

/** 繁中 labels for the same reasons, kept separate so the desk panel can
 *  render both without a locale round trip. */
export const TICKET_REASON_LABELS_ZH: Record<TicketReason, string> = {
  fee_amount: "費用金額",
  no_show: "導師缺席",
  cannot_pay: "無法付款",
  wrong_tutor: "導師不符",
  other: "其他",
};

export const TICKET_NOTE_MAX = 500;
export const TICKET_BODY_MAX = 500;

/**
 * Who can act on a ticket. Migration 20261127140000 allows exactly these four
 * `author_role` / `opened_by_role` values; the union lives here so the server
 * fn, the party card and the tests read one vocabulary.
 */
export type TicketAuthorRole = "parent" | "tutor" | "centre" | "staff";

/**
 * The stored author role for a caller already authorised as this party. The
 * mapping is the pin, not a transform: a fifth caller kind must be added here
 * deliberately instead of being written into the table as free text.
 */
const PARTY_AUTHOR_ROLE: Record<TicketAuthorRole, TicketAuthorRole> = {
  parent: "parent",
  tutor: "tutor",
  centre: "centre",
  staff: "staff",
};

export function partyTicketAuthorRole(role: TicketAuthorRole): TicketAuthorRole {
  return PARTY_AUTHOR_ROLE[role];
}

/** A ticket accepts new messages only while it is open; resolved and closed
 *  are read-only. */
export function ticketIsOpen(status: string): boolean {
  return status === "open";
}

export type TicketInputError = "NOTE_REQUIRED" | "NOTE_TOO_LONG";

/**
 * Why a new ticket cannot be opened, or null when it can.
 * `other` must say something; every note is capped at 500 characters. A blank
 * note on any other reason is not an error — the server stores null for it.
 */
export function ticketInputError(input: {
  reason: TicketReason;
  note?: string | null;
}): TicketInputError | null {
  const note = (input.note ?? "").trim();
  if (input.reason === "other" && note.length === 0) return "NOTE_REQUIRED";
  if (note.length > TICKET_NOTE_MAX) return "NOTE_TOO_LONG";
  return null;
}

export type ReplyError = "EMPTY" | "TOO_LONG" | "CONTACT_DETAILS";

/**
 * Why a staff reply cannot be sent, or null when it can. Contact details
 * (phones, emails, links, chat-app names) are rejected outright: the desk
 * answers inside the ticket, not on WhatsApp.
 */
export function replyError(body: string): ReplyError | null {
  const text = body.trim();
  if (text.length === 0) return "EMPTY";
  if (text.length > TICKET_BODY_MAX) return "TOO_LONG";
  if (hasContactDetails(text)) return "CONTACT_DETAILS";
  return null;
}

/**
 * The ticket tables ship with migration 20261127140000. Until it is applied,
 * reads and writes must degrade to a quiet "not available" state rather than
 * a 500. PostgREST reports 42P01 ("relation ... does not exist"); the older
 * client phrases the same failure as "Could not find the table ...". Reads go
 * through describeDbError, which prefixes the code, so the message carries it.
 */
export function isMissingRelation(error: unknown): boolean {
  if (typeof error === "string") {
    return /does not exist|could not find the table/i.test(error);
  }
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; message?: unknown };
  if (e.code === "42P01") return true;
  return (
    typeof e.message === "string" && /does not exist|could not find the table/i.test(e.message)
  );
}

/** AC-260-1: one open ticket per case. */
export function canOpenTicket(openCount: number): boolean {
  return openCount === 0;
}
