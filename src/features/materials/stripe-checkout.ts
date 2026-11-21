/**
 * #784 §2.1 (was #543 / #573 / #429): Stripe Checkout for digital materials
 * on the Option A rail. Pure rules shared by the server fns, the webhook and
 * vitest. Money moves only through Stripe; nothing here holds 1-on-1 tuition.
 *
 *  - The buyer pays EXACTLY the listed price (no surcharge line).
 *  - MatchMax keeps a pure 2% platform fee (#573 launch rate); the seller
 *    also bears the ACTUAL Stripe fee (balance_transaction.fee).
 *  - Notes / file goods: a 72h protection hold from paid_at.
 */

import { HOLD_HOURS, PLATFORM_FEE_RATE } from "@/features/materials/marketplace-policy";

const cents = (value: number) => Math.round(value * 100) / 100;

/** Stripe amounts are integer minor units (HKD cents). */
export function toStripeAmount(hkd: number): number {
  return Math.round(hkd * 100);
}

export function fromStripeAmount(minor: number): number {
  return cents(minor / 100);
}

/** Option A money for one order (gateway fee = the actual Stripe fee). */
export function optionAMoney(grossHkd: number, gatewayFeeHkd: number | null) {
  const gross = cents(Math.max(0, grossHkd));
  const platformFeeHkd = cents(gross * PLATFORM_FEE_RATE);
  const gateway = gatewayFeeHkd == null ? null : cents(Math.max(0, gatewayFeeHkd));
  const sellerNetHkd = cents(Math.max(0, gross - platformFeeHkd - (gateway ?? 0)));
  return {
    grossHkd: gross,
    platformFeePct: PLATFORM_FEE_RATE * 100,
    platformFeeHkd,
    gatewayFeeHkd: gateway,
    sellerNetHkd,
  };
}

/** hold_expires_at = paid_at + 72h (notes / file goods). */
export function holdExpiresAt(paidAt: Date, holdHours = HOLD_HOURS): string {
  return new Date(paidAt.getTime() + holdHours * 60 * 60 * 1000).toISOString();
}

/** Kinds sold through Stripe Checkout (never gigs on this slice, never tuition). */
const STRIPE_KINDS = new Set(["notes", "mock", "exemplar", "flashcards", "topic_folder"]);
export function isStripeCheckoutKind(materialType: string): boolean {
  return STRIPE_KINDS.has(materialType);
}

export type WebhookAction =
  { kind: "mark_paid" } | { kind: "cancel" } | { kind: "record_fee" } | { kind: "ignore" };

/**
 * What a verified Stripe event means for an order. The handlers are
 * conditional updates on the order's CURRENT status, so a replayed event is
 * always a no-op (AC-543-3).
 */
export function webhookAction(event: {
  type: string;
  paymentStatus?: string | null;
}): WebhookAction {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return event.paymentStatus === "paid" ? { kind: "mark_paid" } : { kind: "ignore" };
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed":
      return { kind: "cancel" };
    case "charge.succeeded":
    case "charge.updated":
      return { kind: "record_fee" };
    default:
      return { kind: "ignore" };
  }
}
