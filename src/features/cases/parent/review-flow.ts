/**
 * Issues #205 + #287, parent-side pure helpers: review submit state machine
 * and slot-request validation. No DB access; vitest-covered.
 *
 * #794 §2.1 (CEO lock 2026-11-18) supersedes the #649 N=2 + fee-settlement
 * publish gates: one eligible completed lesson publishes, and a later save on
 * the same case always UPDATES the same row (one row per case per direction).
 * Timing (14-day edit window, post-case-end freeze) lives in rating-window.ts.
 */

import {
  buildParentDisplayLine,
  parentCanReviewCase,
  validateReviewInput,
  type LessonConfirmRow,
  type ReviewDirection,
} from "@/features/cases/case-reviews";

export type ExistingReview = {
  id: string;
  status: "visible" | "held" | "hidden" | "replaced";
  author_account_id: string;
  /** ISO of the last save (#794 edit window anchor). */
  updated_at?: string | null;
  /** Completed-lesson count at the last save (#794 "new lesson" reopen). */
  completed_lessons_at_write?: number | null;
};

export type ReviewSubmitDecision =
  | {
      action: "insert" | "update";
      reviewId?: string;
      status: "visible" | "held";
      heldReason?: string;
      /** Text actually persisted — '' when a contact hold strips it. */
      comment: string;
    }
  | { action: "reject"; message: string };

/**
 * Decide what a rating submission does against existing rows:
 *  - #794: no eligible COMPLETED lesson on the case -> reject (a pre-lesson
 *    stop gets the private desk report instead, never a public review)
 *  - #794: the row publishes immediately (status 'visible'); the only hold is
 *    the #205 contact filter, which keeps the star but strips the public text
 *    so no phone / email / WhatsApp leaks onto a card
 *  - an existing row (visible / held / hidden) is UPDATED in place — never a
 *    second row and never a 'replaced' public review
 */
export function decideReviewSubmit(input: {
  lessons: LessonConfirmRow[];
  rating: number;
  comment: string;
  existingMine: ExistingReview[];
}): ReviewSubmitDecision {
  if (!parentCanReviewCase(input.lessons)) {
    return { action: "reject", message: "NO_ELIGIBLE_LESSON" };
  }
  const validity = validateReviewInput("parent_to_tutor", input.rating, input.comment);
  if (!validity.ok) return { action: "reject", message: validity.message };

  const trimmed = input.comment.trim();
  const contactHeld = validity.heldReasons.length > 0;
  const heldReason = contactHeld ? `comment_held: ${validity.heldReasons.join(", ")}` : undefined;
  const comment = contactHeld ? "" : trimmed;

  const existing = input.existingMine.find((r) => r.status !== "replaced");
  if (existing) {
    return { action: "update", reviewId: existing.id, status: "visible", heldReason, comment };
  }
  return { action: "insert", status: "visible", heldReason, comment };
}

/** Display-line snapshot from the case (#205/#287 "Parent of G11 IB Physics"). */
export function parentDisplayLineFromCase(parts: {
  student_level?: string | null;
  student_grade_current?: string | null;
  exam_system?: string | null;
  subjects?: string[] | null;
}): string {
  return buildParentDisplayLine({
    studentLevel: parts.student_level,
    studentGradeCurrent: parts.student_grade_current,
    examSystem: parts.exam_system,
    subject: parts.subjects?.[0] ?? null,
  });
}

export type SlotRequestCheck =
  { ok: true } | { ok: false; reason: "CASE_NOT_ACTIVE" | "NOT_AN_OFFERED_SLOT" | "SLOT_CONFLICT" };

/**
 * Validate a parent slot request against the derived slot list (#204):
 * the case must be fee_paid|active, and the requested start must exactly
 * match a generated slot (which already excludes booked/conflicting times).
 */
export function checkSlotRequest(
  caseStatus: string | null,
  requestedStartIso: string,
  offeredSlots: { startsAt: Date }[],
): SlotRequestCheck {
  if (caseStatus !== "fee_paid" && caseStatus !== "active") {
    return { ok: false, reason: "CASE_NOT_ACTIVE" };
  }
  const requested = Date.parse(requestedStartIso);
  if (Number.isNaN(requested)) return { ok: false, reason: "NOT_AN_OFFERED_SLOT" };
  const offered = offeredSlots.some((s) => s.startsAt.getTime() === requested);
  return offered ? { ok: true } : { ok: false, reason: "NOT_AN_OFFERED_SLOT" };
}

/** Direction helper for the shared validators. */
export const PARENT_DIRECTION: ReviewDirection = "parent_to_tutor";
