import { createFileRoute } from "@tanstack/react-router";

/**
 * #784 §2.1: Stripe webhook for the notes Checkout. Verifies the signature
 * with STRIPE_WEBHOOK_SECRET (Web Crypto, Workers-safe) before touching any
 * order. 400 on a bad signature, 500 on a handler failure (Stripe retries;
 * the handlers are idempotent). Register in Stripe as POST
 * https://matchmax.hk/api/stripe/webhook (POST is never locale-redirected).
 */
export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        const signature = request.headers.get("stripe-signature");
        if (!secret || !signature) return new Response("not configured", { status: 400 });

        const body = await request.text();
        const { default: Stripe } = await import("stripe");
        const { getStripe } = await import("@/features/materials/stripe.server");
        let stripe;
        let event;
        try {
          stripe = getStripe();
          event = await stripe.webhooks.constructEventAsync(
            body,
            signature,
            secret,
            undefined,
            Stripe.createSubtleCryptoProvider(),
          );
        } catch {
          return new Response("invalid signature", { status: 400 });
        }

        try {
          const { handleStripeEvent } = await import("@/features/materials/stripe-webhook.server");
          const result = await handleStripeEvent(stripe, event);
          return Response.json({ received: true, result });
        } catch (e) {
          console.error(
            "[stripe] webhook handler failed:",
            event.type,
            e instanceof Error ? e.message : e,
          );
          return new Response("handler error", { status: 500 });
        }
      },
    },
  },
});
