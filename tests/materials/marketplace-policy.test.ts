import { describe, expect, it } from "vitest";

import {
  availableBalanceHkd,
  canOpenDispute,
  canRefund,
  DISPUTE_CODES,
  earningsEstimate,
  gatewayFeeFromStripeCents,
  hasDuplicatePurchase,
  isSellerFault,
  payoutDueHkd,
  planRefund,
  platformFeeHkd,
  scanListing,
  sellerNetPayoutHkd,
  validateListingPrice,
} from "../../src/features/materials/marketplace-policy";

describe("#573 pricing (Option A)", () => {
  it("allows free or HK$20-5,000 (HK$50 floor for marking)", () => {
    expect(validateListingPrice(0)).toBeNull();
    expect(validateListingPrice(20)).toBeNull();
    expect(validateListingPrice(19)).toBe("below_minimum");
    expect(validateListingPrice(5)).toBe("below_minimum");
    expect(validateListingPrice(5000)).toBeNull();
    expect(validateListingPrice(5001)).toBe("above_maximum");
    expect(validateListingPrice(-1)).toBe("negative");
    expect(validateListingPrice(40, "marking_service")).toBe("below_minimum");
    expect(validateListingPrice(10.555)).toBe("not_whole_cents");
  });

  it("deducts 2% + the gateway fee from the seller, buyer pays the list price", () => {
    expect(platformFeeHkd(100)).toBe(2);
    expect(sellerNetPayoutHkd(100, 5.75)).toBe(92.25);
    expect(earningsEstimate(100)).toEqual({ gross: 100, platform: 2, gateway: 5.75, net: 92.25 });
    expect(earningsEstimate(0)).toEqual({ gross: 0, platform: 0, gateway: 0, net: 0 });
    expect(gatewayFeeFromStripeCents(575)).toBe(5.75);
  });
});

describe("#573 disputes (D1-D9, D10 removed)", () => {
  it("has exactly D1-D9", () => {
    expect(DISPUTE_CODES).toHaveLength(9);
    expect((DISPUTE_CODES as readonly string[]).includes("D10")).toBe(false);
    expect(isSellerFault("D1")).toBe(true);
    expect(isSellerFault("D9")).toBe(false);
  });

  it("seller fault: buyer 100%, gateway fee offset on the seller", () => {
    expect(planRefund({ code: "D2", grossHkd: 100, gatewayFeeHkd: 5.75 })).toEqual({
      status: "refunded_full",
      buyerRefundHkd: 100,
      sellerOffsetHkd: 5.75,
      requiresManagerApproval: false,
    });
    expect(
      planRefund({ code: "D8", grossHkd: 600, gatewayFeeHkd: 22.75, chargebackFeeHkd: 150 }),
    ).toMatchObject({
      buyerRefundHkd: 600,
      sellerOffsetHkd: 172.75,
      requiresManagerApproval: true,
    });
  });

  it("D9 duplicate: buyer refunded minus the gateway fee, no seller offset", () => {
    expect(planRefund({ code: "D9", grossHkd: 100, gatewayFeeHkd: 5.75 })).toMatchObject({
      status: "refunded_less_fees",
      buyerRefundHkd: 94.25,
      sellerOffsetHkd: 0,
    });
  });

  it("refunds only from held funds, disputes only inside the window", () => {
    expect(canRefund("paid_held")).toBe(true);
    expect(canRefund("disputed_frozen")).toBe(true);
    expect(canRefund("completed_released")).toBe(false);
    const now = new Date("2026-11-02T00:00:00Z");
    expect(
      canOpenDispute({ status: "paid_held", hold_expires_at: "2026-11-02T01:00:00Z" }, now),
    ).toBe(true);
    expect(
      canOpenDispute({ status: "paid_held", hold_expires_at: "2026-11-01T23:00:00Z" }, now),
    ).toBe(false);
    expect(
      canOpenDispute(
        { status: "completed_released", hold_expires_at: "2026-11-03T00:00:00Z" },
        now,
      ),
    ).toBe(false);
  });

  it("D9 needs another paid order for the same listing", () => {
    const orders = [
      { id: "a", material_id: "m1", status: "paid_held" },
      { id: "b", material_id: "m1", status: "paid_held" },
      { id: "c", material_id: "m2", status: "refunded_full" },
    ];
    expect(hasDuplicatePurchase(orders, { id: "b", material_id: "m1" })).toBe(true);
    expect(hasDuplicatePurchase(orders, { id: "c", material_id: "m2" })).toBe(false);
  });
});

describe("#573 payouts and negative balance", () => {
  it("offsets can push the balance negative; payout only from HK$50", () => {
    const balance = availableBalanceHkd([
      { kind: "sale_net", amountHkd: 92.25 },
      { kind: "refund_offset", amountHkd: -5.75 },
      { kind: "payout", amountHkd: -86.5 },
      { kind: "chargeback_offset", amountHkd: -150 },
    ]);
    expect(balance).toBe(-150);
    expect(payoutDueHkd(balance)).toBe(0);
    expect(payoutDueHkd(49.99)).toBe(0);
    expect(payoutDueHkd(50)).toBe(50);
    expect(payoutDueHkd(12, true)).toBe(12);
  });
});

describe("#573 upload scanner", () => {
  it("flags exam-authority material, marking schemes and contact details", () => {
    expect(
      scanListing({
        listingText: "DSE Chem 考評局 marking scheme",
        fileText: "x".repeat(300),
        hasFile: true,
      }),
    ).toEqual(expect.arrayContaining(["exam_authority", "marking_scheme"]));
    expect(
      scanListing({
        listingText: "Notes",
        fileText: `${"y".repeat(300)} WhatsApp 9123 4567`,
        hasFile: true,
      }),
    ).toContain("contact_details");
  });
  it("routes scans with no text layer to staff", () => {
    expect(scanListing({ listingText: "IB Bio notes", fileText: "", hasFile: true })).toEqual([
      "no_text_layer",
    ]);
  });
  it("passes a clean listing", () => {
    expect(
      scanListing({
        listingText: "IB Biology HL revision notes",
        fileText: "Cell biology ".repeat(40),
        hasFile: true,
      }),
    ).toEqual([]);
  });
});

describe("#573 buyer watermark and launch switch", async () => {
  const { deliveredFooterText, maskEmail, optionACopyKey, NOTES_OPTION_A_LIVE } =
    await import("../../src/features/materials/marketplace-policy");
  it("masks the buyer email", () => {
    expect(maskEmail("jane.doe@gmail.com")).toBe("j***@g***.com");
    expect(maskEmail("bad")).toBeNull();
    expect(
      deliveredFooterText({
        orderRef: "MM-1234",
        buyerEmail: "a@b.hk",
        buyerAccountId: "1234567890",
      }),
    ).toBe("Licensed to a***@b***.hk · Order #MM-1234 · One student only · matchmax.hk");
  });
  it("keeps current copy until launch, swaps at launch", () => {
    expect(NOTES_OPTION_A_LIVE).toBe(false);
    expect(optionACopyKey("materials.disclaimer")).toBe("materials.disclaimer");
    expect(optionACopyKey("materials.disclaimer", true)).toBe("notes_option_a.disclaimer");
    expect(optionACopyKey("guide.notes.s1_title", true)).toBe("guide.notes.s1_title");
  });
});
