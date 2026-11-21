/**
 * #784 §2.1: the Stripe client. Keys live ONLY in the deployment environment
 * (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET); nothing here is committed or
 * sent to the browser. Uses the fetch HTTP client so it runs on Cloudflare
 * Workers.
 */

import Stripe from "stripe";

let client: Stripe | null = null;

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("CHECKOUT_UNAVAILABLE");
  if (!client) {
    client = new Stripe(key, {
      httpClient: Stripe.createFetchHttpClient(),
      maxNetworkRetries: 1,
    });
  }
  return client;
}

/** The site origin for Checkout return URLs (staging and production alike). */
export async function requestOrigin(): Promise<string> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const url = getRequest()?.url;
    if (url) return new URL(url).origin;
  } catch {
    // fall through
  }
  return "https://matchmax.hk";
}
