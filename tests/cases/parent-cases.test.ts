import { describe, expect, it } from "vitest";

import {
  checkSlotRequest,
  decideReviewSubmit,
  parentDisplayLineFromCase,
} from "../../src/features/cases/parent/review-flow";
import {
  canPublishHeldReview,
  FEE_SETTLEMENT_HOLD_REASON,
  isCaseFeeSettledStatus,
  PENDING_LESSON_HOLD_REASON,
  publicRatingLessonEligible,
  ratingPromptDue,
  tutorRatingBadgeState,
} from "../../src/features/cases/case-reviews";

const doneLesson = {
  status: "done",
  confirmed_by_parent_at: "2026-01-01T00:00:00Z",
  confirmed_by_tutor_at: "2026-01-01T00:00:00Z",
};
const secondDoneLesson = {
  status: "confirmed",
  confirmed_by_parent_at: "2026-01-08T00:00:00Z",
  confirmed_by_tutor_at: "2026-01-08T00:00:00Z",
};
const plannedLesson = {
  status: "planned",
  confirmed_by_parent_at: null,
  confirmed_by_tutor_at: null,
};
const cleanComment = "Great tutor, very clear explanations.";

describe("review submit state machine (#205/#287)", () => {
  it("rejects without a bilaterally confirmed lesson (#503)", () => {
    const res = decideReviewSubmit({
      lessons: [plannedLesson],
      rating: 5,
      comment: cleanComment,
      existingMine: [],
      feeSettled: false,
    });
    expect(res).toEqual({ action: "reject", message: "NO_VERIFIED_LESSON" });
  });

  it("rejects a tutor-only done lesson (parent never confirmed, #503)", () => {
    const res = decideReviewSubmit({
      lessons: [{ status: "done", confirmed_by_parent_at: null, confirmed_by_tutor_at: "t" }],
      rating: 5,
      comment: cleanComment,
      existingMine: [],
      feeSettled: true,
    });
    expect(res).toEqual({ action: "reject", message: "NO_VERIFIED_LESSON" });
  });

  it("inserts visible when clean, no prior review, fee settled + lesson N=2 (#649)", () => {
    const res = decideReviewSubmit({
      lessons: [doneLesson, secondDoneLesson],
      rating: 5,
      comment: "Explained IB Physics paper 2 clearly.",
      existingMine: [],
      feeSettled: true,
    });
    expect(res).toEqual({ action: "insert", status: "visible" });
  });

  it("holds a fee-settled clean review under pending_lesson_threshold at only ONE lesson (#649)", () => {
    const res = decideReviewSubmit({
      lessons: [doneLesson],
      rating: 5,
      comment: "Explained IB Physics paper 2 clearly.",
      existingMine: [],
      feeSettled: true,
    });
    expect(res).toEqual({
      action: "insert",
      status: "held",
      heldReason: PENDING_LESSON_HOLD_REASON,
    });
  });

  it("holds when the comment carries contact details (fee + N reached)", () => {
    const res = decideReviewSubmit({
      lessons: [doneLesson, secondDoneLesson],
      rating: 4,
      comment: "Reach me on 9123 4567 anytime.",
      existingMine: [],
      feeSettled: true,
    });
    expect(res).toEqual({
      action: "insert",
      status: "held",
      heldReason: "held: phone",
    });
  });

  it("replaces a visible review (old row stays)", () => {
    const res = decideReviewSubmit({
      lessons: [doneLesson, secondDoneLesson],
      rating: 3,
      comment: "Updated opinion after more lessons.",
      existingMine: [{ id: "r1", status: "visible", author_account_id: "p1" }],
      feeSettled: true,
    });
    expect(res).toEqual({ action: "replace", oldReviewId: "r1", status: "visible" });
  });

  it("updates a held review instead of inserting a second", () => {
    const res = decideReviewSubmit({
      lessons: [doneLesson, secondDoneLesson],
      rating: 5,
      comment: "Clean text this time.",
      existingMine: [{ id: "r2", status: "held", author_account_id: "p1" }],
      feeSettled: true,
    });
    expect(res).toEqual({ action: "update", reviewId: "r2", status: "visible" });
  });

  it("rejects invalid ratings and comment bounds", () => {
    const base = { lessons: [doneLesson], existingMine: [] as never[], feeSettled: true };
    expect(decideReviewSubmit({ ...base, rating: 6, comment: "x".repeat(50) }).action).toBe(
      "reject",
    );
    expect(decideReviewSubmit({ ...base, rating: 5, comment: "short" }).action).toBe("reject");
    expect(decideReviewSubmit({ ...base, rating: 5, comment: "x".repeat(601) }).action).toBe(
      "reject",
    );
  });
});

describe("fee-settlement hold (#386)", () => {
  it("holds a clean review under pending_fee_settlement while the fee is unsettled", () => {
    const res = decideReviewSubmit({
      lessons: [doneLesson],
      rating: 5,
      comment: cleanComment,
      existingMine: [],
      feeSettled: false,
    });
    expect(res).toEqual({
      action: "insert",
      status: "held",
      heldReason: FEE_SETTLEMENT_HOLD_REASON,
    });
  });

  it("combines the fee hold with contact holds (contact still blocks publish)", () => {
    const res = decideReviewSubmit({
      lessons: [doneLesson],
      rating: 4,
      comment: "Reach me on 9123 4567 anytime.",
      existingMine: [],
      feeSettled: false,
    });
    expect(res).toEqual({
      action: "insert",
      status: "held",
      heldReason: `${FEE_SETTLEMENT_HOLD_REASON} + held: phone`,
    });
  });

  it("updates the existing held row (never a second review) while fee-held", () => {
    const res = decideReviewSubmit({
      lessons: [doneLesson],
      rating: 5,
      comment: cleanComment,
      existingMine: [{ id: "r3", status: "held", author_account_id: "p1" }],
      feeSettled: false,
    });
    expect(res).toEqual({
      action: "update",
      reviewId: "r3",
      status: "held",
      heldReason: FEE_SETTLEMENT_HOLD_REASON,
    });
  });

  it("replaces a visible review as fee-held when the fee is unsettled", () => {
    const res = decideReviewSubmit({
      lessons: [doneLesson],
      rating: 5,
      comment: cleanComment,
      existingMine: [{ id: "r4", status: "visible", author_account_id: "p1" }],
      feeSettled: false,
    });
    expect(res).toMatchObject({ action: "replace", oldReviewId: "r4", status: "held" });
  });

  it("settled-rule matrix: only fee-settlement SoR states count", () => {
    expect(isCaseFeeSettledStatus("fee_paid")).toBe(true);
    expect(isCaseFeeSettledStatus("active")).toBe(true);
    expect(isCaseFeeSettledStatus("replaced")).toBe(true);
    expect(isCaseFeeSettledStatus("waived")).toBe(true);
    expect(isCaseFeeSettledStatus("lesson_1_done")).toBe(false);
    expect(isCaseFeeSettledStatus("fee_invoiced")).toBe(false);
    // closed is reachable from pre-fee states — not proof of settlement.
    expect(isCaseFeeSettledStatus("closed")).toBe(false);
    expect(isCaseFeeSettledStatus(null)).toBe(false);
    expect(isCaseFeeSettledStatus(undefined)).toBe(false);
  });

  it("only a PURE fee-settlement hold is publishable", () => {
    expect(canPublishHeldReview(FEE_SETTLEMENT_HOLD_REASON)).toBe(true);
    expect(canPublishHeldReview(`${FEE_SETTLEMENT_HOLD_REASON} + held: phone`)).toBe(false);
    expect(canPublishHeldReview("held: phone")).toBe(false);
    expect(canPublishHeldReview(null)).toBe(false);
    expect(canPublishHeldReview(undefined)).toBe(false);
  });
});

describe("#649 lesson-N gate + public aggregate (CEO locks, 2026-11-04 HKT)", () => {
  it("the fee hold wins while BOTH conditions are missing (fee is the primary reason)", () => {
    const res = decideReviewSubmit({
      lessons: [doneLesson], // only 1 eligible lesson, fee unsettled
      rating: 5,
      comment: cleanComment,
      existingMine: [],
      feeSettled: false,
    });
    expect(res).toMatchObject({ status: "held", heldReason: FEE_SETTLEMENT_HOLD_REASON });
  });

  it("combines the lesson-threshold hold with contact holds (contact still blocks publish)", () => {
    const res = decideReviewSubmit({
      lessons: [doneLesson], // fee settled, lesson N not reached, contact in text
      rating: 4,
      comment: "Reach me on 9123 4567 anytime.",
      existingMine: [],
      feeSettled: true,
    });
    expect(res).toEqual({
      action: "insert",
      status: "held",
      heldReason: `${PENDING_LESSON_HOLD_REASON} + held: phone`,
    });
  });

  it("two bilaterally confirmed lessons reach N; one does not", () => {
    expect(publicRatingLessonEligible([doneLesson])).toBe(false);
    expect(publicRatingLessonEligible([doneLesson, secondDoneLesson])).toBe(true);
    // A planned or single-side-confirmed lesson never counts toward N.
    expect(
      publicRatingLessonEligible([
        doneLesson,
        { status: "done", confirmed_by_parent_at: null, confirmed_by_tutor_at: "t" },
      ]),
    ).toBe(false);
    expect(ratingPromptDue([doneLesson])).toBe(false);
    expect(ratingPromptDue([doneLesson, secondDoneLesson])).toBe(true);
  });

  it("only a PURE lesson-threshold hold is publishable; combined stays held", () => {
    expect(canPublishHeldReview(PENDING_LESSON_HOLD_REASON)).toBe(true);
    expect(canPublishHeldReview(`${PENDING_LESSON_HOLD_REASON} + held: phone`)).toBe(false);
  });

  it("badge state: 0 → new, 1–2 → count_only, ≥3 → full (never a fake average)", () => {
    expect(tutorRatingBadgeState(0)).toBe("new");
    expect(tutorRatingBadgeState(1)).toBe("count_only");
    expect(tutorRatingBadgeState(2)).toBe("count_only");
    expect(tutorRatingBadgeState(3)).toBe("full");
    expect(tutorRatingBadgeState(10)).toBe("full");
  });
});

describe("display line snapshot", () => {
  it("builds 'Parent of G11 IB Physics' from case fields", () => {
    expect(
      parentDisplayLineFromCase({ student_level: "G11", exam_system: "IB", subjects: ["Physics"] }),
    ).toBe("Parent of G11 IB Physics");
    expect(parentDisplayLineFromCase({})).toBe("Parent of a parent");
  });
});

describe("slot request validation (#204)", () => {
  const slot = { startsAt: new Date("2026-10-19T08:00:00Z") };
  it("requires a fee_paid|active case", () => {
    expect(checkSlotRequest("lesson_2_done", slot.startsAt.toISOString(), [slot])).toEqual({
      ok: false,
      reason: "CASE_NOT_ACTIVE",
    });
    expect(checkSlotRequest("active", slot.startsAt.toISOString(), [slot])).toEqual({ ok: true });
    expect(checkSlotRequest("fee_paid", slot.startsAt.toISOString(), [slot])).toEqual({ ok: true });
  });

  it("requires an exactly-offered slot", () => {
    expect(checkSlotRequest("active", "2026-10-19T08:01:00Z", [slot])).toEqual({
      ok: false,
      reason: "NOT_AN_OFFERED_SLOT",
    });
    expect(checkSlotRequest("active", "not-a-date", [slot])).toEqual({
      ok: false,
      reason: "NOT_AN_OFFERED_SLOT",
    });
  });
});
