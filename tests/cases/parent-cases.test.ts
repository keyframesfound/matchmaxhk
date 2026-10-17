import { describe, expect, it } from "vitest";

import {
  checkSlotRequest,
  decideReviewSubmit,
  parentDisplayLineFromCase,
} from "../../src/features/cases/parent/review-flow";

const doneLesson = { status: "done" };
const plannedLesson = { status: "planned" };

describe("review submit state machine (#205/#287)", () => {
  it("rejects without a done lesson", () => {
    const res = decideReviewSubmit({
      lessons: [plannedLesson],
      rating: 5,
      comment: "Great tutor, very clear explanations.",
      existingMine: [],
    });
    expect(res).toEqual({ action: "reject", message: "NO_DONE_LESSON" });
  });

  it("inserts visible when clean and no prior review", () => {
    const res = decideReviewSubmit({
      lessons: [doneLesson],
      rating: 5,
      comment: "Explained IB Physics paper 2 clearly.",
      existingMine: [],
    });
    expect(res).toEqual({ action: "insert", status: "visible" });
  });

  it("holds when the comment carries contact details", () => {
    const res = decideReviewSubmit({
      lessons: [doneLesson],
      rating: 4,
      comment: "Reach me on 9123 4567 anytime.",
      existingMine: [],
    });
    expect(res).toMatchObject({ action: "insert", status: "held" });
  });

  it("replaces a visible review (old row stays)", () => {
    const res = decideReviewSubmit({
      lessons: [doneLesson],
      rating: 3,
      comment: "Updated opinion after more lessons.",
      existingMine: [{ id: "r1", status: "visible", author_account_id: "p1" }],
    });
    expect(res).toEqual({ action: "replace", oldReviewId: "r1", status: "visible" });
  });

  it("updates a held review instead of inserting a second", () => {
    const res = decideReviewSubmit({
      lessons: [doneLesson],
      rating: 5,
      comment: "Clean text this time.",
      existingMine: [{ id: "r2", status: "held", author_account_id: "p1" }],
    });
    expect(res).toEqual({ action: "update", reviewId: "r2", status: "visible" });
  });

  it("rejects invalid ratings and comment bounds", () => {
    const base = { lessons: [doneLesson], existingMine: [] as never[] };
    expect(decideReviewSubmit({ ...base, rating: 6, comment: "x".repeat(50) }).action).toBe(
      "reject",
    );
    expect(decideReviewSubmit({ ...base, rating: 5, comment: "short" }).action).toBe("reject");
    expect(decideReviewSubmit({ ...base, rating: 5, comment: "x".repeat(601) }).action).toBe(
      "reject",
    );
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
