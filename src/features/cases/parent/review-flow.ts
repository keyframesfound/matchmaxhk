/**
 * Issues #205 + #287, parent-side pure helpers: review submit state machine
 * and slot-request validation. No DB access; vitest-covered.
 */

import {
  buildParentDisplayLine,
  FEE_SETTLEMENT_HOLD_REASON,
  PENDING_LESSON_HOLD_REASON,
  parentCanReviewCase,
  publicRatingLessonEligible,
  validateReviewInput,
  type LessonConfirmRow,
  type ReviewDirection,
} from "@/features/cases/case-reviews";

export type ExistingReview = {
  id: string;
  status: "visible" | "held" | "hidden" | "replaced";
  author_account_id: string;
};

export type ReviewSubmitDecision =
  | { action: "insert"; status: "visible" | "held"; heldReason?: string }
  | { action: "replace"; oldReviewId: string; status: "visible" | "held"; heldReason?: string }
  | { action: "update"; reviewId: string; status: "visible" | "held"; heldReason?: string }
  | { action: "reject"; message: string };

/**
 * Decide what a parent review submission does against existing rows:
 *  - #503: no bilaterally confirmed lesson on the case -> reject (both parties
 *    must have confirmed at least one lesson; tutor-only logging never unlocks)
 *  - #386 + #649: the review publishes only when the case's admin fee is
 *    settled AND lesson N is reached (CEO LOCK N = 2). While either is
 *    missing the row is HELD under a pure reason the lazy publish flips —
 *    pending_fee_settlement when the fee is missing (the stronger,
 *    primary condition), else pending_lesson_threshold (fee settled, short
 *    case). Contact reasons combine as "+ held: …" and never auto-publish
 *  - an existing HELD review by the same parent is UPDATED (one row per
 *    case+direction per author as much as the unique allows)
 *  - an existing VISIBLE review by the same parent is REPLACED (old row stays
 *    in admin as 'replaced')
 */
export function decideReviewSubmit(input: {
  lessons: LessonConfirmRow[];
  rating: number;
  comment: string;
  existingMine: ExistingReview[];
  /** #386: is the case's applicable admin fee already settled? */
  feeSettled: boolean;
}): ReviewSubmitDecision {
  if (!parentCanReviewCase(input.lessons)) {
    return { action: "reject", message: "NO_VERIFIED_LESSON" };
  }
  const validity = validateReviewInput("parent_to_tutor", input.rating, input.comment);
  if (!validity.ok) return { action: "reject", message: validity.message };

  const contactHeld =
    validity.heldReasons.length > 0 ? `held: ${validity.heldReasons.join(", ")}` : undefined;
  // #386 + #649 public gate: visible only when the fee is settled AND lesson
  // N (2) is reached. One PURE hold reason per missing condition keeps the
  // lazy publish exact — it re-checks BOTH conditions before flipping.
  const feeMissing = !input.feeSettled;
  const lessonsMissing = !publicRatingLessonEligible(input.lessons);
  let status: "visible" | "held";
  let heldReason: string | undefined;
  if (feeMissing || lessonsMissing) {
    status = "held";
    const base = feeMissing ? FEE_SETTLEMENT_HOLD_REASON : PENDING_LESSON_HOLD_REASON;
    heldReason = contactHeld ? `${base} + ${contactHeld}` : base;
  } else {
    status = contactHeld ? "held" : "visible";
    heldReason = contactHeld;
  }

  const held = input.existingMine.find((r) => r.status === "held");
  if (held) return { action: "update", reviewId: held.id, status, heldReason };
  const visible = input.existingMine.find((r) => r.status === "visible");
  if (visible) return { action: "replace", oldReviewId: visible.id, status, heldReason };
  return { action: "insert", status, heldReason };
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
