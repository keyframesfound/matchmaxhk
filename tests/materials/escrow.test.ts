/**
 * Issue #429 (V1 core): escrow hold + seller-funded refunds — the pure
 * helpers in lifecycle.ts are the vitest target (TanStart server fns are not
 * testable end-to-end). Money rules are CEO locks 2026-10-23:
 *   - hold window 72h new seller / 48h established
 *   - refund ONLY from still-held funds, seller-funded
 *   - MatchMax keeps 20% of the NON-refunded portion; $0 fee + $0 net on a
 *     100% refund
 *   - held rows are NEVER payable (the manual monthly FPS run is the gate)
 */
import { describe, expect, it } from "vitest";

import {
  HOLD_HOURS_ESTABLISHED,
  HOLD_HOURS_NEW_SELLER,
  boughtListAction,
  buildEscrowReleaseFields,
  canOpenDispute,
  computeHoldUntil,
  disputeReasonLabelKey,
  disputeRefundTarget,
  disputeRejectTarget,
  holdWindowHours,
  isFullRefundAmount,
  isHoldExpired,
  isPayableForPayout,
  orderGrantsAccess,
  refundedOrderKeepsAccess,
  splitRefundMoney,
  validateDisputeRefundAmount,
} from "../../src/features/materials/lifecycle";

const NOW = new Date("2026-10-25T12:00:00Z");

describe("holdWindowHours — new-seller rule (#429)", () => {
  it("returns 72h when the seller has fewer than 3 completed deliveries", () => {
    expect(holdWindowHours(0, null, NOW)).toBe(HOLD_HOURS_NEW_SELLER);
    expect(holdWindowHours(1, "2026-01-01T00:00:00Z", NOW)).toBe(HOLD_HOURS_NEW_SELLER);
    expect(holdWindowHours(2, "2026-01-01T00:00:00Z", NOW)).toBe(HOLD_HOURS_NEW_SELLER);
  });

  it("returns 72h when the FIRST delivery is within 14 days, even with 3+ sales", () => {
    const thirteenDays = new Date(NOW.getTime() - 13 * 86_400_000).toISOString();
    expect(holdWindowHours(5, thirteenDays, NOW)).toBe(HOLD_HOURS_NEW_SELLER);
  });

  it("returns 48h once the seller is established (3+ sales, first older than 14 days)", () => {
    const fifteenDays = new Date(NOW.getTime() - 15 * 86_400_000).toISOString();
    expect(holdWindowHours(3, fifteenDays, NOW)).toBe(HOLD_HOURS_ESTABLISHED);
    expect(holdWindowHours(30, "2026-01-01T00:00:00Z", NOW)).toBe(HOLD_HOURS_ESTABLISHED);
  });

  it("treats a missing/unparseable first delivery as new (fail toward caution)", () => {
    expect(holdWindowHours(3, null, NOW)).toBe(HOLD_HOURS_NEW_SELLER);
    expect(holdWindowHours(3, "not-a-date", NOW)).toBe(HOLD_HOURS_NEW_SELLER);
  });
});

describe("computeHoldUntil / isHoldExpired", () => {
  it("adds the window hours to delivered_at", () => {
    expect(computeHoldUntil("2026-10-25T12:00:00Z", 48)).toBe("2026-10-27T12:00:00.000Z");
    expect(computeHoldUntil("2026-10-25T12:00:00Z", 72)).toBe("2026-10-28T12:00:00.000Z");
  });

  it("flags an expired hold and ignores null/garbage", () => {
    expect(isHoldExpired("2026-10-25T00:00:00Z", NOW)).toBe(true);
    expect(isHoldExpired("2026-10-26T00:00:00Z", NOW)).toBe(false);
    expect(isHoldExpired(null, NOW)).toBe(false);
    expect(isHoldExpired("garbage", NOW)).toBe(false);
  });
});

describe("buildEscrowReleaseFields — real money holds, HK$0 delivers", () => {
  it("holds a paid order with hold_until = delivered_at + window", () => {
    const fields = buildEscrowReleaseFields({
      grossHkd: 120,
      holdHours: 72,
      deliveredAtIso: "2026-10-25T12:00:00Z",
    });
    expect(fields.status).toBe("held");
    expect(fields.holdUntilIso).toBe("2026-10-28T12:00:00.000Z");
  });

  it("delivers HK$0 orders (free packs / grants) without escrow", () => {
    const fields = buildEscrowReleaseFields({
      grossHkd: 0,
      holdHours: 48,
      deliveredAtIso: "2026-10-25T12:00:00Z",
    });
    expect(fields.status).toBe("delivered");
    expect(fields.holdUntilIso).toBeNull();
  });
});

describe("splitRefundMoney — seller-funded refund math (#429 CEO lock)", () => {
  it("keeps 20% of only the non-refunded portion on a partial refund", () => {
    // HK$100 gross, HK$40 refunded: remaining 60, fee 12, net 48.
    expect(splitRefundMoney(100, 40)).toEqual({
      refundedHkd: 40,
      platformFeeHkd: 12,
      tutorNetHkd: 48,
    });
  });

  it("charges $0 platform fee and leaves $0 seller net on a 100% refund", () => {
    expect(splitRefundMoney(100, 100)).toEqual({
      refundedHkd: 100,
      platformFeeHkd: 0,
      tutorNetHkd: 0,
    });
  });

  it("matches the clean-release split when nothing is refunded", () => {
    expect(splitRefundMoney(100, 0)).toEqual({
      refundedHkd: 0,
      platformFeeHkd: 20,
      tutorNetHkd: 80,
    });
  });

  it("handles rounding on awkward amounts", () => {
    // HK$99.99 gross, HK$33.33 refunded: remaining 66.66, fee 13.33 (0.2*66.66=13.332→13.33), net 53.33.
    const split = splitRefundMoney(99.99, 33.33);
    expect(split.refundedHkd).toBe(33.33);
    expect(split.platformFeeHkd).toBe(13.33);
    expect(split.tutorNetHkd).toBe(53.33);
  });
});

describe("validateDisputeRefundAmount — partial must be >0 and < gross", () => {
  it("accepts full and partial amounts", () => {
    expect(validateDisputeRefundAmount(100, 100)).toBeNull();
    expect(validateDisputeRefundAmount(40, 100)).toBeNull();
  });

  it("rejects 0, negative, and above-gross amounts", () => {
    expect(validateDisputeRefundAmount(0, 100)).toMatch(/greater than 0/);
    expect(validateDisputeRefundAmount(-5, 100)).toMatch(/greater than 0/);
    expect(validateDisputeRefundAmount(100.01, 100)).toMatch(/cannot exceed/);
    expect(validateDisputeRefundAmount(Number.NaN, 100)).toMatch(/greater than 0/);
  });
});

describe("isFullRefundAmount / refundedOrderKeepsAccess", () => {
  it("treats amount >= gross as a full refund", () => {
    expect(isFullRefundAmount(100, 100)).toBe(true);
    expect(isFullRefundAmount(120, 100)).toBe(true);
    expect(isFullRefundAmount(99.99, 100)).toBe(false);
  });

  it("keeps buyer access on a partial refund, revokes on a full refund", () => {
    expect(refundedOrderKeepsAccess(40, 100)).toBe(true);
    expect(refundedOrderKeepsAccess(100, 100)).toBe(false);
    expect(refundedOrderKeepsAccess(null, 100)).toBe(false);
  });
});

describe("status machine — access, badges, transitions", () => {
  it("keeps buyer download access for delivered, held and released orders", () => {
    for (const status of ["delivered", "held", "released"]) {
      expect(orderGrantsAccess(status)).toBe(true);
      expect(boughtListAction(status)).toBe("download");
    }
    expect(orderGrantsAccess("refunded")).toBe(false);
  });

  it("refunded_from_hold keeps access only when partial", () => {
    expect(boughtListAction("refunded_from_hold", 40, 100)).toBe("download");
    expect(boughtListAction("refunded_from_hold", 100, 100)).toBe("refunded");
    expect(boughtListAction("refunded_from_hold", null, 100)).toBe("refunded");
  });

  it("legacy statuses keep their mapping", () => {
    expect(boughtListAction("refunded")).toBe("refunded");
    expect(boughtListAction("paid")).toBe("preparing");
  });

  it("disputes can be opened while delivered or held only", () => {
    expect(canOpenDispute("delivered")).toBe(true);
    expect(canOpenDispute("held")).toBe(true);
    for (const status of [
      "awaiting_payment",
      "paid",
      "stamping",
      "released",
      "refunded",
      "refunded_from_hold",
    ]) {
      expect(canOpenDispute(status)).toBe(false);
    }
  });

  it("refunds resolve FROM THE HOLD ONLY", () => {
    expect(disputeRefundTarget("held")).toBe("refunded_from_hold");
    expect(disputeRefundTarget("delivered")).toBeNull(); // legacy: no held funds
    expect(disputeRefundTarget("released")).toBeNull();
  });

  it("reject releases a held order; a legacy delivered row just closes the dispute", () => {
    expect(disputeRejectTarget("held")).toBe("released");
    expect(disputeRejectTarget("delivered")).toBe("delivered");
    expect(disputeRejectTarget("refunded")).toBeNull();
  });
});

describe("isPayableForPayout — the desk is the gate (#429)", () => {
  it("a held order is NEVER payable", () => {
    expect(isPayableForPayout("held", false, 80)).toBe(false);
  });

  it("released and legacy delivered rows are payable with a positive net", () => {
    expect(isPayableForPayout("released", false, 80)).toBe(true);
    expect(isPayableForPayout("delivered", false, 80)).toBe(true);
  });

  it("a refunded_from_hold row pays only what survived the refund", () => {
    expect(isPayableForPayout("refunded_from_hold", false, 48)).toBe(true);
    expect(isPayableForPayout("refunded_from_hold", false, 0)).toBe(false);
  });

  it("grants and HK$0 nets never pay", () => {
    expect(isPayableForPayout("released", true, 80)).toBe(false);
    expect(isPayableForPayout("released", false, 0)).toBe(false);
    expect(isPayableForPayout("awaiting_payment", false, 80)).toBe(false);
    expect(isPayableForPayout("refunded", false, 80)).toBe(false);
  });
});

describe("disputeReasonLabelKey — static i18n map", () => {
  it("maps every enum value and falls back to other", () => {
    expect(disputeReasonLabelKey("file_defective")).toBe("orders.reason_file_defective");
    expect(disputeReasonLabelKey("materially_different")).toBe(
      "orders.reason_materially_different",
    );
    expect(disputeReasonLabelKey("not_as_described")).toBe("orders.reason_not_as_described");
    expect(disputeReasonLabelKey("junk")).toBe("orders.reason_other");
  });
});
