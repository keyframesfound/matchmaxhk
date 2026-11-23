/**
 * #784 §2.1: Stripe webhook handling for the notes Checkout. Every write is a
 * conditional update on the order's CURRENT state, so a replayed or
 * out-of-order event is a no-op (AC-543-3). Never logs card or secret data.
 */

import type Stripe from "stripe";

import { asAdminDb, type AdminDb } from "@/features/materials/storage-helpers";
import {
  fromStripeAmount,
  holdExpiresAt,
  optionAMoney,
  webhookAction,
} from "@/features/materials/stripe-checkout";

type Db = AdminDb;

async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return asAdminDb(supabaseAdmin);
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/** Attach the ACTUAL Stripe fee and recompute the seller net (AC-543-2). */
async function recordFeeForPaymentIntent(db: Db, stripe: Stripe, paymentIntentId: string) {
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge.balance_transaction"],
  });
  const charge = pi.latest_charge as Stripe.Charge | null;
  const bt = charge?.balance_transaction as Stripe.BalanceTransaction | null | undefined;
  if (!bt || typeof bt === "string") return; // not settled yet; charge.updated retries
  const { data: rows } = await db
    .from<{ id: string; gross_hkd: number | string }>("material_orders")
    .select("id, gross_hkd")
    .eq("stripe_payment_intent_id", paymentIntentId);
  for (const row of rows ?? []) {
    const money = optionAMoney(Number(row.gross_hkd), fromStripeAmount(bt.fee));
    await db
      .from<never>("material_orders")
      .update({
        gateway_fee_hkd: money.gatewayFeeHkd,
        platform_fee_pct: money.platformFeePct,
        platform_fee_hkd: money.platformFeeHkd,
        tutor_net_hkd: money.sellerNetHkd,
        seller_net_payout_hkd: money.sellerNetHkd,
      })
      .eq("id", row.id);
  }
}

export async function handleStripeEvent(stripe: Stripe, event: Stripe.Event): Promise<string> {
  const db = await adminDb();
  const object = event.data.object as unknown as Record<string, unknown>;
  const action = webhookAction({
    type: event.type,
    paymentStatus: typeof object.payment_status === "string" ? object.payment_status : null,
  });

  if (action.kind === "mark_paid") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.order_id ?? session.client_reference_id ?? null;
    if (!orderId) return "no_order";
    const paymentIntentId = idOf(session.payment_intent as string | { id: string } | null);
    const paidAt = new Date();
    // Conditional: only an unpaid order flips, so a replay never re-grants.
    const { count, error } = await db
      .from<never>("material_orders")
      .update(
        {
          status: "paid",
          paid_at: paidAt.toISOString(),
          hold_expires_at: holdExpiresAt(paidAt),
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: paymentIntentId,
        },
        { count: "exact" },
      )
      .eq("id", orderId)
      .eq("status", "awaiting_payment");
    if (error) throw new Error(error.message);
    if ((count ?? 0) === 0) {
      // A previous attempt may have flipped the order to paid and then failed
      // before delivery. performOrderRelease writes "stamp_failed" on exactly
      // that R2/stamp error, and a crashed run can leave "stamping" behind, so
      // the recovery claim covers all three undelivered states. The claim is a
      // single conditional UPDATE, so concurrent duplicate events cannot both
      // deliver (and double-increment sold_count).
      const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      // Reclaim a crashed run first: a stale "stamping" row is treated as failed.
      await db
        .from<never>("material_orders")
        .update({ status: "stamp_failed" })
        .eq("id", orderId)
        .eq("status", "stamping")
        .lte("updated_at", staleBefore)
        .or("delivered_at.is.null");
      const { count: claimed, error: claimError } = await db
        .from<never>("material_orders")
        .update({ status: "stamping" }, { count: "exact" })
        .eq("id", orderId)
        .in("status", ["paid", "paid_held", "stamp_failed"])
        .or("delivered_at.is.null");
      if (claimError) throw new Error(claimError.message);
      if ((claimed ?? 0) === 0) return "already_processed";
      const { deliverStripePaidOrder } = await import("@/features/materials/checkout.functions");
      await deliverStripePaidOrder(db, orderId);
      return "delivery_recovered";
    }

    const { deliverStripePaidOrder } = await import("@/features/materials/checkout.functions");
    await deliverStripePaidOrder(db, orderId);
    if (paymentIntentId) {
      try {
        await recordFeeForPaymentIntent(db, stripe, paymentIntentId);
      } catch (e) {
        console.warn("[stripe] fee not attached yet:", e instanceof Error ? e.message : e);
      }
    }
    return "paid";
  }

  if (action.kind === "cancel") {
    const session = event.data.object as Stripe.Checkout.Session;
    // The order stays unpaid (no charge); clearing the session lets the buyer retry.
    await db
      .from<never>("material_orders")
      .update({ stripe_checkout_session_id: null })
      .eq("stripe_checkout_session_id", session.id)
      .eq("status", "awaiting_payment");
    return "cancelled";
  }

  if (action.kind === "record_fee") {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId = idOf(charge.payment_intent as string | { id: string } | null);
    if (paymentIntentId) await recordFeeForPaymentIntent(db, stripe, paymentIntentId);
    return "fee";
  }
  return "ignored";
}
