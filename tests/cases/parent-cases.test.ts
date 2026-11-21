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

describe("review submit state machine (#794 §2.1 — one lesson publishes)", () => {
  it("rejects without any completed lesson", () => {
    const res = decideReviewSubmit({
      lessons: [plannedLesson],
      rating: 5,
      comment: cleanComment,
      existingMine: [],
    });
    expect(res).toEqual({ action: "reject", message: "NO_ELIGIBLE_LESSON" });
  });

  it("accepts a Mark-done lesson on its own (CEO lock: completion unlocks)", () => {
    const res = decideReviewSubmit({
      lessons: [{ status: "done", confirmed_by_parent_at: null, confirmed_by_tutor_at: "t" }],
      rating: 5,
      comment: cleanComment,
      existingMine: [],
    });
    expect(res).toMatchObject({ action: "insert", status: "visible" });
  });

  it("inserts visible after ONE eligible lesson — no fee settlement, no N=2", () => {
    const res = decideReviewSubmit({
      lessons: [doneLesson],
      rating: 5,
      comment: "Explained IB Physics paper 2 clearly.",
      existingMine: [],
    });
    expect(res).toEqual({
      action: "insert",
      status: "visible",
      heldReason: undefined,
      comment: "Explained IB Physics paper 2 clearly.",
    });
  });

  it("publishes the stars but strips contact text (#205 hold)", () => {
    const res = decideReviewSubmit({
      lessons: [doneLesson],
      rating: 4,
      comment: "Reach me on 9123 4567 anytime.",
      existingMine: [],
    });
    expect(res).toMatchObject({
      action: "insert",
      status: "visible",
      heldReason: "comment_held: phone",
      comment: "",
    });
  });

  it("updates the single existing row in place — never a second public review", () => {
    for (const status of ["visible", "held", "hidden"] as const) {
      const res = decideReviewSubmit({
        lessons: [doneLesson, secondDoneLesson],
        rating: 3,
        comment: "Updated opinion after more lessons.",
        existingMine: [{ id: "r1", status, author_account_id: "p1" }],
      });
      expect(res).toEqual({
        action: "update",
        reviewId: "r1",
        status: "visible",
        heldReason: undefined,
        comment: "Updated opinion after more lessons.",
      });
    }
  });

  it("accepts an empty comment (text is optional) and rejects the bounds", () => {
    const base = { lessons: [doneLesson], existingMine: [] as never[] };
    expect(decideReviewSubmit({ ...base, rating: 5, comment: "" })).toMatchObject({
      action: "insert",
      comment: "",
    });
    expect(decideReviewSubmit({ ...base, rating: 6, comment: "x".repeat(50) }).action).toBe(
      "reject",
    );
    expect(decideReviewSubmit({ ...base, rating: 5, comment: "x".repeat(601) }).action).toBe(
      "reject",
    );
  });
});

describe("legacy fee-settlement helpers (#386/#649 — kept for old rows only)", () => {
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

  it("only a PURE legacy hold is publishable", () => {
    expect(canPublishHeldReview(FEE_SETTLEMENT_HOLD_REASON)).toBe(true);
    expect(canPublishHeldReview(PENDING_LESSON_HOLD_REASON)).toBe(true);
    expect(canPublishHeldReview(`${FEE_SETTLEMENT_HOLD_REASON} + held: phone`)).toBe(false);
    expect(canPublishHeldReview("held: phone")).toBe(false);
    expect(canPublishHeldReview(null)).toBe(false);
    expect(canPublishHeldReview(undefined)).toBe(false);
  });
});

describe("#794 §2.1 gates + public aggregate", () => {
  it("one completed lesson reaches the prompt and the public gate", () => {
    expect(publicRatingLessonEligible([doneLesson])).toBe(true);
    expect(publicRatingLessonEligible([doneLesson, secondDoneLesson])).toBe(true);
    // A planned or cancelled lesson never counts.
    expect(publicRatingLessonEligible([plannedLesson])).toBe(false);
    expect(
      publicRatingLessonEligible([
        { status: "cancelled", confirmed_by_parent_at: null, confirmed_by_tutor_at: null },
      ]),
    ).toBe(false);
    expect(ratingPromptDue([doneLesson])).toBe(true);
    expect(ratingPromptDue([plannedLesson])).toBe(false);
  });

  it("badge state: 0 → new, 1–2 → fresh (average + New cue), ≥3 → established", () => {
    expect(tutorRatingBadgeState(0)).toBe("new");
    expect(tutorRatingBadgeState(1)).toBe("fresh");
    expect(tutorRatingBadgeState(2)).toBe("fresh");
    expect(tutorRatingBadgeState(3)).toBe("established");
    expect(tutorRatingBadgeState(10)).toBe("established");
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
