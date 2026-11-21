/**
 * #784 §2.1: open a Stripe Checkout Session for an order startCheckout has
 * already created (all listing / ownership / terms checks ran there). Only
 * used when NOTES_OPTION_A_LIVE is on and STRIPE_SECRET_KEY is configured;
 * the FPS cashier is untouched otherwise.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { NOTES_OPTION_A_LIVE } from "@/features/materials/marketplace-policy";
import {
  isStripeCheckoutKind,
  optionAMoney,
  toStripeAmount,
} from "@/features/materials/stripe-checkout";

export const CHECKOUT_UNAVAILABLE_MESSAGE =
  "Checkout is temporarily unavailable. Please try again shortly. / 結帳暫時未能使用，請稍後再試。";

/** Whether the browser should send buyers to Stripe (flag on + keys present). */
export const getStripeCheckoutAvailability = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ enabled: boolean }> => {
    const { stripeConfigured } = await import("@/features/materials/stripe.server");
    return { enabled: NOTES_OPTION_A_LIVE && stripeConfigured() };
  },
);

type OrderRow = {
  id: string;
  buyer_account_id: string;
  material_id: string;
  status: string;
  gross_hkd: number | string;
  stripe_checkout_session_id: string | null;
  digital_materials: { title: string | null; slug: string | null; material_type: string } | null;
};

export const startStripeCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ url: string } | { alreadyPaid: true }> => {
    const { stripeConfigured, getStripe, requestOrigin } =
      await import("@/features/materials/stripe.server");
    if (!NOTES_OPTION_A_LIVE || !stripeConfigured()) throw new Error(CHECKOUT_UNAVAILABLE_MESSAGE);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { data: order } = await db
      .from<OrderRow>("material_orders")
      .select(
        "id, buyer_account_id, material_id, status, gross_hkd, stripe_checkout_session_id, digital_materials(title, slug, material_type)",
      )
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order || order.buyer_account_id !== context.userId) throw new Error("ORDER_NOT_FOUND");
    // Already paid / delivered: never charge twice; the order page has the download.
    if (order.status !== "awaiting_payment") return { alreadyPaid: true };
    const material = order.digital_materials;
    if (!material || !isStripeCheckoutKind(material.material_type)) {
      throw new Error(CHECKOUT_UNAVAILABLE_MESSAGE);
    }
    const money = optionAMoney(Number(order.gross_hkd), null);
    if (!(money.grossHkd > 0)) throw new Error("FREE_LISTING_NO_PAYMENT");

    const stripe = getStripe();
    // Reuse an open session for this order rather than opening a second one.
    if (order.stripe_checkout_session_id) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id);
        if (existing.status === "open" && existing.url) return { url: existing.url };
      } catch {
        // expired / unknown: open a fresh one below
      }
    }

    // Option A snapshot: 2% platform fee; the Stripe fee is attached later.
    await db
      .from<never>("material_orders")
      .update({
        platform_fee_pct: money.platformFeePct,
        platform_fee_hkd: money.platformFeeHkd,
        tutor_net_hkd: money.sellerNetHkd,
      })
      .eq("id", order.id)
      .eq("status", "awaiting_payment");

    const origin = await requestOrigin();
    const slug = material.slug ?? order.material_id;
    let session;
    try {
      session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          currency: "hkd",
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "hkd",
                unit_amount: toStripeAmount(money.grossHkd),
                product_data: { name: (material.title ?? "MatchMax study notes").slice(0, 250) },
              },
            },
          ],
          client_reference_id: order.id,
          metadata: { order_id: order.id },
          payment_intent_data: { metadata: { order_id: order.id } },
          success_url: `${origin}/orders/${order.id}?checkout=success`,
          cancel_url: `${origin}/notes/${encodeURIComponent(slug)}?checkout=cancelled&order=${order.id}`,
        },
        { idempotencyKey: `checkout-${order.id}-${Date.now() >> 16}` },
      );
    } catch (e) {
      console.error("[stripe] session create failed:", e instanceof Error ? e.message : e);
      throw new Error(CHECKOUT_UNAVAILABLE_MESSAGE);
    }
    if (!session.url) throw new Error(CHECKOUT_UNAVAILABLE_MESSAGE);

    await db
      .from<never>("material_orders")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", order.id)
      .eq("status", "awaiting_payment");
    return { url: session.url };
  });
