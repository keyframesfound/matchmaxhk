import { describe, expect, it } from "vitest";

import {
  computeSellerReplyDueAt,
  disputeRefundTarget,
  disputeRejectTarget,
  DISPUTE_SELLER_REPLY_HOURS,
  OPEN_DISPUTE_STATUSES,
  shouldSkipRelease,
} from "../../src/features/materials/lifecycle";

describe("#784 AC-543-4 dispute freeze", () => {
  it("freezes release while a dispute is open or the seller has replied", () => {
    expect(OPEN_DISPUTE_STATUSES).toEqual(["open", "seller_responded"]);
    expect(shouldSkipRelease({ dispute_status: "open" })).toBe(true);
    expect(shouldSkipRelease({ dispute_status: "seller_responded" })).toBe(true);
    expect(shouldSkipRelease({ dispute_status: null })).toBe(false);
    expect(shouldSkipRelease({ dispute_status: "rejected" })).toBe(false);
    expect(shouldSkipRelease({ dispute_status: "refunded" })).toBe(false);
  });

  it("starts the seller reply clock at exactly 48 hours", () => {
    const now = new Date("2026-11-28T00:00:00.000Z");
    expect(DISPUTE_SELLER_REPLY_HOURS).toBe(48);
    expect(computeSellerReplyDueAt(now)).toBe("2026-11-30T00:00:00.000Z");
  });

  it("allows a refund from every live hold state", () => {
    for (const status of ["held", "paid_held", "delivered_held", "disputed_frozen"]) {
      expect(disputeRefundTarget(status)).toBe("refunded_from_hold");
    }
    expect(disputeRefundTarget("delivered")).toBeNull();
    expect(disputeRefundTarget("completed_released")).toBeNull();
  });

  it("rejects a Stripe dispute into completed_released, not plain released", () => {
    expect(disputeRejectTarget("paid_held")).toBe("completed_released");
    expect(disputeRejectTarget("delivered_held")).toBe("completed_released");
    expect(disputeRejectTarget("disputed_frozen")).toBe("completed_released");
    expect(disputeRejectTarget("held")).toBe("released");
    expect(disputeRejectTarget("delivered")).toBe("delivered");
    expect(disputeRejectTarget("completed_released")).toBeNull();
  });
});
