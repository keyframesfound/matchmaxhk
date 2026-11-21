import { describe, expect, it } from "vitest";

import {
  fromStripeAmount,
  holdExpiresAt,
  isStripeCheckoutKind,
  optionAMoney,
  toStripeAmount,
  webhookAction,
} from "../../src/features/materials/stripe-checkout";
import { orderGrantsAccess } from "../../src/features/materials/lifecycle";

describe("#784 §2.1 Stripe Checkout rules", () => {
  it("charges exactly the listed price in HKD cents (AC-543-1)", () => {
    expect(toStripeAmount(120)).toBe(12000);
    expect(toStripeAmount(19.99)).toBe(1999);
    expect(fromStripeAmount(643)).toBe(6.43);
  });

  it("seller net = gross - 2% - actual Stripe fee (AC-543-2)", () => {
    const m = optionAMoney(120, 6.43);
    expect(m.platformFeeHkd).toBe(2.4);
    expect(m.gatewayFeeHkd).toBe(6.43);
    expect(m.sellerNetHkd).toBe(111.17);
    expect(m.platformFeePct).toBe(2);
    expect(optionAMoney(120, null).sellerNetHkd).toBe(117.6);
  });

  it("starts the 72h hold at paid_at", () => {
    expect(holdExpiresAt(new Date("2026-11-21T00:00:00Z"))).toBe("2026-11-24T00:00:00.000Z");
  });

  it("only notes kinds use Checkout; never gigs or tuition (AC-543-7)", () => {
    expect(isStripeCheckoutKind("notes")).toBe(true);
    expect(isStripeCheckoutKind("gig")).toBe(false);
  });

  it("maps events to idempotent actions (AC-543-3)", () => {
    expect(webhookAction({ type: "checkout.session.completed", paymentStatus: "paid" })).toEqual({
      kind: "mark_paid",
    });
    expect(webhookAction({ type: "checkout.session.completed", paymentStatus: "unpaid" })).toEqual({
      kind: "ignore",
    });
    expect(webhookAction({ type: "checkout.session.expired" })).toEqual({ kind: "cancel" });
    expect(webhookAction({ type: "charge.updated" })).toEqual({ kind: "record_fee" });
    expect(webhookAction({ type: "customer.created" })).toEqual({ kind: "ignore" });
  });

  it("buyers keep access through the Stripe hold and after release", () => {
    for (const s of ["paid_held", "delivered_held", "completed_released"]) {
      expect(orderGrantsAccess(s), s).toBe(true);
    }
    // #543: no access while the buyer's own dispute is open.
    expect(orderGrantsAccess("disputed_frozen")).toBe(false);
    expect(orderGrantsAccess("awaiting_payment")).toBe(false);
  });
});
