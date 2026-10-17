/**
 * Issues #205 + #287 — case review rules (pure half).
 *
 * One score, one comment, per direction, per case. A comment containing a
 * phone, email, or WhatsApp reference is HELD, not published. The card shows
 * "Parent of G11 IB Physics" — a snapshot built from the case at write time.
 *
 * Comment bounds differ by direction: parent→tutor 20–600 (#205), tutor→parent
 * 20–400 (#287 P7). Both bounds are enforced server-side; the client mirrors
 * them for inline hints.
 */

import { CONTACT_EMAIL_PATTERN } from "@/lib/contact-filter";

export type ReviewDirection = "parent_to_tutor" | "tutor_to_parent";

export const REVIEW_COMMENT_MIN = 20;
export const REVIEW_COMMENT_MAX_PARENT = 600;
export const REVIEW_COMMENT_MAX_TUTOR = 400;
/** #205: a new review after 30 days replaces the public one; the old row stays in admin. */
export const REVIEW_REPLACE_AFTER_DAYS = 30;

export function reviewCommentMax(direction: ReviewDirection): number {
  return direction === "parent_to_tutor" ? REVIEW_COMMENT_MAX_PARENT : REVIEW_COMMENT_MAX_TUTOR;
}

export type ReviewHeldReason = "phone" | "email" | "whatsapp";

/** WhatsApp detector: channel words + wa.me links (superset of the tutor-card filter). */
const WHATSAPP_PATTERN = /\b(?:whats\s?app|wa\.me|weixin)\b/i;

/** Hong Kong-ish phone detector, mirroring the #215 contact filter's looseness. */
const PHONE_PATTERN =
  /(?:\+?852[\s-]?)?[2-9]\d{3}[\s-]?\d{4}\b|\b\d{2,4}[\s-]\d{3,4}[\s-]\d{3,4}\b/;

export function findReviewHolds(comment: string): ReviewHeldReason[] {
  const holds: ReviewHeldReason[] = [];
  if (WHATSAPP_PATTERN.test(comment)) holds.push("whatsapp");
  if (CONTACT_EMAIL_PATTERN.test(comment)) holds.push("email");
  if (PHONE_PATTERN.test(comment)) holds.push("phone");
  return holds;
}

export type ValidateReviewInputResult =
  | { ok: true; heldReasons: ReviewHeldReason[] }
  | { ok: false; field: "comment" | "rating"; message: string };

/** Server-side gate for a submitted review. heldReasons non-empty → store as held. */
export function validateReviewInput(
  direction: ReviewDirection,
  rating: number,
  comment: string,
): ValidateReviewInputResult {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, field: "rating", message: "rating must be 1–5" };
  }
  const trimmed = comment.trim();
  if (trimmed.length < REVIEW_COMMENT_MIN) {
    return {
      ok: false,
      field: "comment",
      message: `comment must be at least ${REVIEW_COMMENT_MIN} characters`,
    };
  }
  const max = reviewCommentMax(direction);
  if (trimmed.length > max) {
    return { ok: false, field: "comment", message: `comment must be at most ${max} characters` };
  }
  return { ok: true, heldReasons: findReviewHolds(trimmed) };
}

/** #205/#287: "Parent of G11 IB Physics" — built from the case snapshot fields. */
export function buildParentDisplayLine(parts: {
  studentLevel?: string | null;
  studentGradeCurrent?: string | null;
  examSystem?: string | null;
  subject?: string | null;
}): string {
  const grade =
    parts.studentGradeCurrent?.trim() ||
    (parts.studentLevel ? parts.studentLevel.replace(/^G/, "G") : null) ||
    "a parent";
  const curriculum = parts.examSystem?.trim();
  const subject = parts.subject?.trim();
  const tail = [curriculum, subject].filter(Boolean).join(" ");
  return tail ? `Parent of ${grade} ${tail}` : `Parent of ${grade}`;
}

/** Can this parent review this case? A done lesson on the case is required (#205/#287). */
export function parentCanReviewCase(lessons: { status: string }[]): boolean {
  return lessons.some((l) => l.status === "done");
}
