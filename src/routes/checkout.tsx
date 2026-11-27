import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, ShieldCheck } from "lucide-react";

import {
  getStripeCheckoutConfig,
  startStripeCheckout,
} from "@/features/materials/stripe-checkout.functions";

/**
 * Full-screen embedded Stripe Checkout (#784 follow-up).
 *
 * The buyer stays on matchmax.hk: the server fn opens (or reuses) a Checkout
 * Session in embedded mode and hands back its client secret, and Stripe.js
 * mounts the payment form here. Stripe owns the form, the wallets and the
 * validation; this route only frames it, so there is no card data in our DOM.
 *
 * The webhook is unchanged: it is what marks the order paid, sets
 * hold_expires_at and delivers the file, so a buyer who closes this tab after
 * paying still gets the order.
 */
export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>) => ({
    order: typeof search.order === "string" ? search.order : "",
  }),
  head: () => ({
    meta: [
      { title: "Checkout | MatchMax" },
      // A payment page must never be indexed.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CheckoutPage,
});

type StripeJs = {
  initEmbeddedCheckout: (options: { clientSecret: string }) => Promise<{
    mount: (selector: string) => void;
    destroy: () => void;
  }>;
};

type StripeFactory = (publishableKey: string) => StripeJs;

let stripeJsLoader: Promise<StripeFactory> | null = null;

/** Load https://js.stripe.com/v3/ once per page load. */
function loadStripeJs(): Promise<StripeFactory> {
  if (typeof window === "undefined") return Promise.reject(new Error("STRIPE_JS_SSR"));
  const existing = (window as unknown as { Stripe?: StripeFactory }).Stripe;
  if (existing) return Promise.resolve(existing);
  if (!stripeJsLoader) {
    stripeJsLoader = new Promise<StripeFactory>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://js.stripe.com/v3/";
      script.async = true;
      script.onload = () => {
        const factory = (window as unknown as { Stripe?: StripeFactory }).Stripe;
        if (factory) resolve(factory);
        else reject(new Error("STRIPE_JS_UNAVAILABLE"));
      };
      script.onerror = () => reject(new Error("STRIPE_JS_UNAVAILABLE"));
      document.head.appendChild(script);
    });
  }
  return stripeJsLoader;
}

function CheckoutPage() {
  const { t } = useTranslation();
  const { order } = Route.useSearch();
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current || !order) return;
    mountedRef.current = true;
    let destroy: (() => void) | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const config = await getStripeCheckoutConfig();
        if (!config.enabled || !config.publishableKey) throw new Error("CHECKOUT_UNAVAILABLE");
        const session = await startStripeCheckout({ data: { orderId: order } });
        if ("alreadyPaid" in session) {
          window.location.replace(`/orders/${order}?checkout=success`);
          return;
        }
        // No publishable key configured: the server opened a hosted session
        // instead, so hand the buyer straight to it.
        if ("url" in session) {
          window.location.assign(session.url);
          return;
        }
        const factory = await loadStripeJs();
        const stripe = factory(config.publishableKey);
        const embedded = await stripe.initEmbeddedCheckout({
          clientSecret: session.clientSecret,
        });
        if (cancelled) {
          embedded.destroy();
          return;
        }
        embedded.mount("#stripe-checkout");
        destroy = () => embedded.destroy();
        setReady(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [order]);

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--background)]">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="text-base font-bold tracking-tight">
            MatchMax
          </Link>
          <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            {t("checkout.secure")}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("checkout.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("checkout.subtitle")}</p>

        {failed ? (
          <div className="mt-6 rounded-[var(--radius-panel)] border border-border bg-card p-6">
            <p className="text-sm">{t("notes_option_a.checkout_unavailable")}</p>
            <p className="mt-3 text-sm">
              <Link to="/account" className="font-semibold underline underline-offset-4">
                {t("checkout.back_to_orders")}
              </Link>
            </p>
          </div>
        ) : (
          <div className="mt-6">
            {!ready ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t("checkout.loading")}
              </p>
            ) : null}
            <div id="stripe-checkout" />
          </div>
        )}
      </main>
    </div>
  );
}
