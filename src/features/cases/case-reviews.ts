/**
 * Issues #205 + #287 + #503, case review rules (pure half).
 *
 * One score, one comment, per direction, per case. A comment containing a
 * phone, email, or WhatsApp reference is HELD, not published. The card shows
 * "Parent of G11 IB Physics", a snapshot built from the case at write time.
 *
 * Comment bounds differ by direction: parent→tutor 20–600 (#205), tutor→parent
 * 20–400 (#287 P7). Both bounds are enforced server-side; the client mirrors
 * them for inline hints.
 *
 * #503: reviews unlock after at least one BILATERALLY confirmed lesson (both
 * confirm columns set), stay editable while the case is ongoing, and freeze
 * once the case ends (sor_status 'closed') — enforced in the submit fns.
 *
 * #649 (Trust): CEO LOCK N = 2 — the post-lesson rating PROMPT fires after
 * two eligible lessons; the L1 write unlock stays as the soft-draft path
 * (draft rows are held, never public before N). CEO LOCK threshold = 3
 * published parent→tutor reviews before a public average shows on the
 * Explore TutorCard / tutor profile; below threshold the card shows
 * "New" (zero reviews) or a count-only line (1–2) — never a fake average
 * and never "0.0".
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

// ---------------------------------------------------------------------------
// #386 fee-settlement publish gate (parent→tutor reviews).
// ---------------------------------------------------------------------------

/** #386: a parent→tutor review is HELD under this reason until the case's
 * applicable admin fee is settled; it must be the ONLY reason on the row for
 * the lazy publish to flip it (contact-holds never auto-publish). */
export const FEE_SETTLEMENT_HOLD_REASON = "pending_fee_settlement";

/**
 * #386 settled rule (single source for TS + the SQL RPC): the case's
 * sor_status is one of the states reachable ONLY through fee settlement —
 * fee_paid → active is the sole path to active, replaced only from active,
 * and waived = settled by waiver. "closed" is deliberately excluded from the
 * status list: it is reachable from pre-fee states (introduced,
 * lesson_1_scheduled), so the status alone is not proof the fee was settled.
 * The 1.0x (L1-terminated) vs 1.5x (L2 done) refinement from #385 is a
 * documented future refinement, not built here.
 */
export const FEE_SETTLED_SOR_STATUSES: readonly string[] = [
  "fee_paid",
  "active",
  "replaced",
  "waived",
];

export function isCaseFeeSettledStatus(sorStatus: string | null | undefined): boolean {
  return sorStatus != null && FEE_SETTLED_SOR_STATUSES.includes(sorStatus);
}

/** Minimal fee-row shape callers pass (only the status column is read). */
export type CaseFeeStatusRow = { status: string };

/**
 * #386 settled rule, full form: settled when the sor_status proves it
 * (see FEE_SETTLED_SOR_STATUSES) OR a case_fees row exists with status
 * 'paid' or 'waived', a settled fee row is direct proof the applicable
 * admin fee was collected or waived, which covers 'closed' cases: a case
 * closed after settlement keeps its paid/waived fee row, while a pre-fee
 * closure has none and correctly stays unsettled.
 */
export function isCaseFeeSettled(
  sorStatus: string | null | undefined,
  feeRows: readonly CaseFeeStatusRow[],
): boolean {
  if (isCaseFeeSettledStatus(sorStatus)) return true;
  return feeRows.some((f) => f.status === "paid" || f.status === "waived");
}

/** UI-copy classifier for a held review's reason (#386): is the fee-settlement
 * hold the only reason, combined with contact reasons, or absent? The lazy
 * publish still uses canPublishHeldReview, only a PURE fee hold flips. */
export function feeHoldKind(heldReason: string | null | undefined): "pure" | "combined" | "none" {
  if (heldReason === FEE_SETTLEMENT_HOLD_REASON) return "pure";
  if (heldReason?.startsWith(`${FEE_SETTLEMENT_HOLD_REASON} + `)) return "combined";
  return "none";
}

/** Only a PURE hold publishes on the lazy read paths; a contact hold
 * (phone/email/WhatsApp) stays held regardless (#205). #649: the
 * lesson-threshold hold (fee settled but fewer than N eligible lessons)
 * is also pure — the lazy publish re-checks BOTH conditions, see
 * publicRatingLessonEligible. */
export const PENDING_LESSON_HOLD_REASON = "pending_lesson_threshold";

const PURE_PUBLISH_HOLD_REASONS: readonly string[] = [
  FEE_SETTLEMENT_HOLD_REASON,
  PENDING_LESSON_HOLD_REASON,
];

export function canPublishHeldReview(heldReason: string | null | undefined): boolean {
  return heldReason != null && PURE_PUBLISH_HOLD_REASONS.includes(heldReason);
}

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

/** #205/#287: "Parent of G11 IB Physics", built from the case snapshot fields. */
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

/**
 * #503 eligibility gate: ratings open after BOTH parties have confirmed at
 * least one lesson on the case — the existing dual-confirm semantics (a
 * lesson is 'confirmed' exactly when confirmed_by_parent_at AND
 * confirmed_by_tutor_at are both set, per confirmLessonParent /
 * confirmLessonTutor). "Tutor logged alone" (a done lesson marked from
 * 'planned' with no parent confirm) does NOT unlock ratings, per the issue.
 * The lesson must still be live-or-done (confirmed/done); a later cancel,
 * late-cancel or no-show unwinds it.
 */
export type LessonConfirmRow = {
  status: string;
  confirmed_by_parent_at: string | null;
  confirmed_by_tutor_at: string | null;
};

/** One lesson counts toward the rating gates when it is live-or-done AND
 * bilaterally confirmed (#503 semantics; the Attendance / desk-confirmed
 * variant arrives with #612 — until then both gates share this predicate). */
export function isEligibleReviewLesson(l: LessonConfirmRow): boolean {
  return (
    (l.status === "confirmed" || l.status === "done") &&
    l.confirmed_by_parent_at != null &&
    l.confirmed_by_tutor_at != null
  );
}

/** How many lessons on the case count toward the rating gates. */
export function eligibleReviewLessonCount(lessons: LessonConfirmRow[]): number {
  return lessons.filter(isEligibleReviewLesson).length;
}

/** Can this parent review this case? A bilaterally confirmed lesson (#503). */
export function parentCanReviewCase(lessons: LessonConfirmRow[]): boolean {
  return eligibleReviewLessonCount(lessons) >= 1;
}

// ---------------------------------------------------------------------------
// #649 Trust gates (CEO locks, 2026-11-04 HKT).
// ---------------------------------------------------------------------------

/** CEO LOCK N = 2: the post-lesson prompt fires after two eligible lessons;
 * a PUBLIC-facing rating also needs two (the L1 write unlock stays as the
 * soft-draft path — draft rows are held, never published before N). */
export const RATING_PROMPT_LESSON_N = 2;

/** CEO LOCK threshold = 3: published parent→tutor reviews before an average
 * shows on the Explore TutorCard / tutor profile. */
export const RATING_PUBLIC_THRESHOLD = 3;

/** #649 prompt gate: has the case reached lesson N (CEO LOCK N = 2)? The
 * write unlock (parentCanReviewCase) stays at one lesson for the soft draft. */
export function ratingPromptDue(
  lessons: LessonConfirmRow[],
  n: number = RATING_PROMPT_LESSON_N,
): boolean {
  return eligibleReviewLessonCount(lessons) >= n;
}

/** #649 public gate: a rating may go out PUBLICLY (status 'visible') only
 * once lesson N is reached. Pair with isCaseFeeSettled — the publish gate is
 * fee-settled AND N lessons (see decideReviewSubmit + the lazy-publish RPC). */
export function publicRatingLessonEligible(
  lessons: LessonConfirmRow[],
  n: number = RATING_PROMPT_LESSON_N,
): boolean {
  return eligibleReviewLessonCount(lessons) >= n;
}

/** #649 aggregate display state from a PUBLISHED-review count (held/hidden
 * rows never count): 'new' (zero reviews → "New", never 0.0), 'count_only'
 * (1–2 → count without an average) or 'full' (≥3 → average + count). */
export function tutorRatingBadgeState(
  publishedCount: number,
  threshold: number = RATING_PUBLIC_THRESHOLD,
): "new" | "count_only" | "full" {
  if (publishedCount <= 0) return "new";
  if (publishedCount < threshold) return "count_only";
  return "full";
}

/** Direction-shared alias for the tutor submit fn (#503: same gate both ways). */
export const caseHasVerifiedLesson = parentCanReviewCase;
