import { describe, expect, it } from "vitest";

import {
  buildParentDisplayLine,
  findReviewHolds,
  parentCanReviewCase,
  reviewCommentMax,
  validateReviewInput,
} from "../../src/features/cases/case-reviews";

describe("case review rules (#205 + #287)", () => {
  it("comment bounds: parent 20–600, tutor 20–400", () => {
    expect(reviewCommentMax("parent_to_tutor")).toBe(600);
    expect(reviewCommentMax("tutor_to_parent")).toBe(400);
    const long600 = "x".repeat(600);
    const long601 = "x".repeat(601);
    expect(validateReviewInput("parent_to_tutor", 5, long600).ok).toBe(true);
    expect(validateReviewInput("parent_to_tutor", 5, long601).ok).toBe(false);
    expect(validateReviewInput("tutor_to_parent", 5, long600).ok).toBe(false);
    const short = "too short";
    expect(validateReviewInput("parent_to_tutor", 5, short).ok).toBe(false);
    expect(validateReviewInput("tutor_to_parent", 5, short).ok).toBe(false);
  });

  it("rating must be 1–5 integer", () => {
    expect(validateReviewInput("parent_to_tutor", 0, "x".repeat(50)).ok).toBe(false);
    expect(validateReviewInput("parent_to_tutor", 6, "x".repeat(50)).ok).toBe(false);
    expect(validateReviewInput("parent_to_tutor", 4.5, "x".repeat(50)).ok).toBe(false);
    expect(validateReviewInput("parent_to_tutor", 3, "x".repeat(50)).ok).toBe(true);
  });

  it("a comment with a phone is held, not published", () => {
    const res = validateReviewInput("parent_to_tutor", 5, "Great tutor! Reach me on 9123 4567.");
    expect(res).toEqual({ ok: true, heldReasons: ["phone"] });
  });

  it("a comment with an email is held", () => {
    const res = validateReviewInput("parent_to_tutor", 5, "Contact me at mum@example.com please.");
    expect(res).toEqual({ ok: true, heldReasons: ["email"] });
  });

  it("a comment with a WhatsApp reference is held", () => {
    const res = validateReviewInput("parent_to_tutor", 5, "Ping me on WhatsApp to chat.");
    expect(res).toEqual({ ok: true, heldReasons: ["whatsapp"] });
  });

  it("clean comments publish directly", () => {
    const res = validateReviewInput(
      "parent_to_tutor",
      5,
      "Explained IB Physics paper 2 clearly and was always five minutes early.",
    );
    expect(res).toEqual({ ok: true, heldReasons: [] });
  });

  it("findReviewHolds returns every reason present", () => {
    expect(findReviewHolds("whatsapp me at a@b.com or 9123 4567").sort()).toEqual([
      "email",
      "phone",
      "whatsapp",
    ]);
  });

  it("buildParentDisplayLine: 'Parent of G11 IB Physics'", () => {
    expect(
      buildParentDisplayLine({ studentLevel: "G11", examSystem: "IB", subject: "Physics" }),
    ).toBe("Parent of G11 IB Physics");
    expect(
      buildParentDisplayLine({
        studentGradeCurrent: "Year 12",
        examSystem: "A-Level",
        subject: "Maths",
      }),
    ).toBe("Parent of Year 12 A-Level Maths");
    expect(buildParentDisplayLine({})).toBe("Parent of a parent");
  });

  it("review opens only after a done lesson (#287 acceptance)", () => {
    expect(parentCanReviewCase([{ status: "confirmed" }])).toBe(false);
    expect(parentCanReviewCase([{ status: "done" }, { status: "planned" }])).toBe(true);
  });
});
