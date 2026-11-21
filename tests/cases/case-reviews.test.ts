import { describe, expect, it } from "vitest";

import {
  buildParentDisplayLine,
  canPublishHeldReview,
  feeHoldKind,
  findReviewHolds,
  isCaseFeeSettled,
  isCaseFeeSettledStatus,
  parentCanReviewCase,
  reviewCommentMax,
  validateReviewInput,
} from "../../src/features/cases/case-reviews";

describe("case review rules (#205 + #287)", () => {
  // #794 §2.1 (CEO lock 2026-11-18): the text is OPTIONAL — the sheet is
  // stars → optional text → optional desk note. Only the upper bound stays.
  it("comment bounds: optional, capped at 600 / 400", () => {
    expect(reviewCommentMax("parent_to_tutor")).toBe(600);
    expect(reviewCommentMax("tutor_to_parent")).toBe(400);
    const long600 = "x".repeat(600);
    const long601 = "x".repeat(601);
    expect(validateReviewInput("parent_to_tutor", 5, long600).ok).toBe(true);
    expect(validateReviewInput("parent_to_tutor", 5, long601).ok).toBe(false);
    expect(validateReviewInput("tutor_to_parent", 5, long600).ok).toBe(false);
    expect(validateReviewInput("parent_to_tutor", 5, "too short").ok).toBe(true);
    expect(validateReviewInput("tutor_to_parent", 5, "").ok).toBe(true);
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

  // #794 §2.1 supersedes #503's bilateral rule: ONE completed lesson unlocks
  // ("Mark done" alone is enough). Planned / cancelled / no-show never count.
  it("#794 §2.1: ratings open after ONE completed lesson", () => {
    const noConfirms = { confirmed_by_parent_at: null, confirmed_by_tutor_at: null };
    // Marked done by the tutor alone still unlocks for the parent.
    expect(parentCanReviewCase([{ status: "done", ...noConfirms }])).toBe(true);
    // Planned lessons unlock nothing, even when both sides confirmed.
    expect(
      parentCanReviewCase([
        { status: "planned", confirmed_by_parent_at: "t", confirmed_by_tutor_at: "t" },
      ]),
    ).toBe(false);
    // A cancelled lesson does not count even with both confirms on record.
    expect(
      parentCanReviewCase([
        { status: "cancelled", confirmed_by_parent_at: "t", confirmed_by_tutor_at: "t" },
      ]),
    ).toBe(false);
    // A live bilaterally confirmed lesson still counts (legacy path).
    expect(
      parentCanReviewCase([
        { status: "confirmed", confirmed_by_parent_at: "t", confirmed_by_tutor_at: "t" },
      ]),
    ).toBe(true);
    // A done lesson from the normal flow (both confirms set) unlocks.
    expect(
      parentCanReviewCase([
        { status: "done", confirmed_by_parent_at: "t", confirmed_by_tutor_at: "t" },
        { status: "planned", ...noConfirms },
      ]),
    ).toBe(true);
    // A one-sided 'confirmed' lesson still waits: only 'done' is completion.
    expect(
      parentCanReviewCase([
        { status: "confirmed", confirmed_by_parent_at: null, confirmed_by_tutor_at: "t" },
      ]),
    ).toBe(false);
    // No-show is never completion.
    expect(
      parentCanReviewCase([
        { status: "no_show", confirmed_by_parent_at: "t", confirmed_by_tutor_at: "t" },
      ]),
    ).toBe(false);
  });
});

describe("#386 fee-settlement publish gate", () => {
  it("sor_status alone settles only through fee-reachable states", () => {
    expect(isCaseFeeSettledStatus("fee_paid")).toBe(true);
    expect(isCaseFeeSettledStatus("active")).toBe(true);
    expect(isCaseFeeSettledStatus("replaced")).toBe(true);
    expect(isCaseFeeSettledStatus("waived")).toBe(true);
    // 'closed' is reachable from pre-fee states — status alone is not proof.
    expect(isCaseFeeSettledStatus("closed")).toBe(false);
    expect(isCaseFeeSettledStatus("lesson_1_done")).toBe(false);
    expect(isCaseFeeSettledStatus(null)).toBe(false);
  });

  it("a paid/waived fee row proves settlement even on a closed case (GLM blocker fix)", () => {
    // The review-loop blocker: closed cases kept reviews held forever because
    // 'closed' is excluded from the status list. A settled fee row is proof.
    expect(isCaseFeeSettled("closed", [{ status: "paid" }])).toBe(true);
    expect(isCaseFeeSettled("closed", [{ status: "invoiced" }, { status: "waived" }])).toBe(true);
    // A pre-fee closure has no settled fee row — stays unsettled.
    expect(isCaseFeeSettled("closed", [])).toBe(false);
    expect(isCaseFeeSettled("closed", [{ status: "invoiced" }])).toBe(false);
    expect(isCaseFeeSettled("closed", [{ status: "not_due" }])).toBe(false);
    // Status proof still works without any fee rows.
    expect(isCaseFeeSettled("fee_paid", [])).toBe(true);
    expect(isCaseFeeSettled(null, [{ status: "paid" }])).toBe(true);
    expect(isCaseFeeSettled(null, [])).toBe(false);
  });

  it("feeHoldKind classifies pure / combined / none (combined copy fix)", () => {
    expect(feeHoldKind("pending_fee_settlement")).toBe("pure");
    expect(feeHoldKind("pending_fee_settlement + held: phone")).toBe("combined");
    expect(feeHoldKind("held: phone")).toBe("none");
    expect(feeHoldKind(null)).toBe("none");
  });

  it("only a PURE fee hold auto-publishes; combined stays held (#205)", () => {
    expect(canPublishHeldReview("pending_fee_settlement")).toBe(true);
    expect(canPublishHeldReview("pending_fee_settlement + held: phone")).toBe(false);
    expect(canPublishHeldReview("held: phone")).toBe(false);
    expect(canPublishHeldReview(null)).toBe(false);
  });
});
