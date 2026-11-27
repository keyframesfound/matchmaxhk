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

/**
 * Whether the browser can start a payment, plus the publishable key Stripe.js
 * needs. Embedded Checkout mounts an iframe with Stripe.js, so unlike the old
 * hosted redirect the browser now needs a publishable key. It is read from the
 * Worker environment and handed over per request rather than inlined at build
 * time, so the same bundle works in every environment.
 */
export const getStripeCheckoutConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ enabled: boolean; publishableKey: string | null }> => {
    const { stripeConfigured } = await import("@/features/materials/stripe.server");
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY ?? null;
    // `enabled` must NOT require the publishable key: without one the session
    // fn returns a hosted url instead, and the /checkout page redirects to it.
    // Gating here would have made that fallback unreachable.
    return {
      enabled: NOTES_OPTION_A_LIVE && stripeConfigured(),
      publishableKey,
    };
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
  .handler(
    async ({
      data,
      context,
    }): Promise<{ clientSecret: string } | { url: string } | { alreadyPaid: true }> => {
      const { stripeConfigured, getStripe, requestOrigin } =
        await import("@/features/materials/stripe.server");
      if (!NOTES_OPTION_A_LIVE || !stripeConfigured())
        throw new Error(CHECKOUT_UNAVAILABLE_MESSAGE);

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
      // Embedded needs a publishable key for Stripe.js. Until one is configured
      // the rail falls back to the hosted redirect, so shipping this can never
      // leave buyers on a dead /checkout page.
      const embedded = Boolean(process.env.STRIPE_PUBLISHABLE_KEY);
      // Reuse an open session for this order rather than opening a second one.
      if (order.stripe_checkout_session_id) {
        try {
          const existing = await stripe.checkout.sessions.retrieve(
            order.stripe_checkout_session_id,
          );
          if (existing.status === "open") {
            if (existing.client_secret) return { clientSecret: existing.client_secret };
            if (existing.url) return { url: existing.url };
          }
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
      let session;
      try {
        // Embedded Checkout (#784 follow-up): the buyer pays inside matchmax.hk
        // on a full-screen /checkout page instead of being sent to
        // checkout.stripe.com. Stripe rejects success_url/cancel_url in this
        // mode; return_url is where it lands once the payment resolves. With no
        // publishable key configured it stays the hosted redirect.
        session = await stripe.checkout.sessions.create(
          {
            ...(embedded ? { ui_mode: "embedded" as const } : {}),
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
            ...(embedded
              ? { return_url: `${origin}/orders/${order.id}?checkout=success` }
              : {
                  success_url: `${origin}/orders/${order.id}?checkout=success`,
                  cancel_url: `${origin}/notes/${encodeURIComponent(
                    material.slug ?? order.material_id,
                  )}?checkout=cancelled&order=${order.id}`,
                }),
          },
          { idempotencyKey: `checkout-${order.id}-${Date.now() >> 16}` },
        );
      } catch (e) {
        console.error("[stripe] session create failed:", e instanceof Error ? e.message : e);
        throw new Error(CHECKOUT_UNAVAILABLE_MESSAGE);
      }

      await db
        .from<never>("material_orders")
        .update({ stripe_checkout_session_id: session.id })
        .eq("id", order.id)
        .eq("status", "awaiting_payment");
      if (session.client_secret) return { clientSecret: session.client_secret };
      if (session.url) return { url: session.url };
      throw new Error(CHECKOUT_UNAVAILABLE_MESSAGE);
    },
  );
