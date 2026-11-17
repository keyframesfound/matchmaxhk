import { describe, expect, it } from "vitest";

import {
  disputeRefundTarget,
  rubricComplete,
  rubricFindsSellerFault,
  validateDisputeDecision,
} from "../../src/features/materials/lifecycle";
import { canRefund } from "../../src/features/materials/marketplace-policy";

const allPass = {
  log_checked: "pass",
  matches_preview: "pass",
  no_banned_content: "pass",
} as const;

describe("#783 §2.1 dispute rubric (AC-559-2)", () => {
  it("needs all three points answered", () => {
    expect(rubricComplete({})).toBe(false);
    expect(rubricComplete({ log_checked: "pass", matches_preview: "fail" })).toBe(false);
    expect(rubricComplete(allPass)).toBe(true);
  });

  it("flags seller fault when any point fails", () => {
    expect(rubricFindsSellerFault(allPass)).toBe(false);
    expect(rubricFindsSellerFault({ ...allPass, no_banned_content: "fail" })).toBe(true);
  });

  it("refuses a decision before the rubric is complete", () => {
    expect(
      validateDisputeDecision({ decision: "reject", rubric: {}, recordStrike: false }),
    ).not.toBeNull();
    expect(
      validateDisputeDecision({ decision: "reject", rubric: allPass, recordStrike: false }),
    ).toBeNull();
  });

  it("records a strike only with a seller-fault refund", () => {
    const fault = { ...allPass, matches_preview: "fail" } as const;
    expect(
      validateDisputeDecision({ decision: "refund", rubric: fault, recordStrike: true }),
    ).toBeNull();
    expect(
      validateDisputeDecision({ decision: "reject", rubric: fault, recordStrike: true }),
    ).not.toBeNull();
    expect(
      validateDisputeDecision({ decision: "refund", rubric: allPass, recordStrike: true }),
    ).not.toBeNull();
  });

  it("never refunds released money (golden rule)", () => {
    expect(disputeRefundTarget("held")).toBe("refunded_from_hold");
    expect(disputeRefundTarget("released")).toBeNull();
    expect(disputeRefundTarget("completed_released")).toBeNull();
    expect(canRefund("completed_released")).toBe(false);
    expect(canRefund("disputed_frozen")).toBe(true);
  });
});
