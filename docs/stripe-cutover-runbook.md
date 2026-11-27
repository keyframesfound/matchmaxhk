# Stripe cutover runbook (#784 §2.1 / §2.3, #783 §2.1)

**Status 2026-11-27:** the rail is built, deployed and mounted. `POST /api/stripe/webhook`
on production answers `400 not configured`, which proves the route is live and the only
thing missing is `STRIPE_WEBHOOK_SECRET`. `NOTES_OPTION_A_LIVE` is now **true**, with the
#783 §2.1 copy in the same release, so the buyer path is the Stripe Checkout the moment
both secrets land — and it fails closed (bilingual "checkout unavailable") until then,
because `getStripeCheckoutAvailability` requires the flag **and** `stripeConfigured()`.

Verified in the repo:

| Piece | Path |
| --- | --- |
| Stripe client, `stripeConfigured()` | `src/features/materials/stripe.server.ts:13` |
| Checkout Session creation | `src/features/materials/stripe-checkout.functions.ts:124` |
| Webhook route | `src/routes/api/stripe/webhook.ts:13` |
| Webhook handlers | `src/features/materials/stripe-webhook.server.ts:76` |
| Event → action map | `src/features/materials/stripe-checkout.ts:59` |
| Order state machine | `src/features/materials/checkout.functions.ts:1073` |
| 72h release sweep (hourly cron) | `tasks/materials-release.ts`, `vite.config.ts:77` |
| Fee model / launch switch | `src/features/materials/marketplace-policy.ts:19` |
| Buyer entry points | `src/routes/notes.\$slug.tsx:207`, `src/routes/orders.\$orderId.tsx:97` |

Schema is already live on production: `material_orders` has
`stripe_checkout_session_id`, `stripe_payment_intent_id`, `gateway_fee_hkd`,
`platform_fee_pct`, `platform_fee_hkd`, `seller_net_payout_hkd`, `hold_expires_at`,
`payout_batch_status`.

---

## 1. What is required in the environment

Only **two** secrets. There is no publishable key and no Stripe.js: Checkout is a
hosted redirect.

| Variable | Used by | Notes |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | `stripe.server.ts:17` | `sk_test_...` until a live charge is approved |
| `STRIPE_WEBHOOK_SECRET` | `src/routes/api/stripe/webhook.ts:14` | `whsec_...` for the `/api/stripe/webhook` endpoint |

No `wrangler.toml` exists: the Worker is built by Cloudflare Workers Builds and reads
its bindings at runtime through `hydrateProcessEnvFromBindings` (`src/server.ts:343`).
Set both in the Cloudflare dashboard under **Workers & Pages → the matchmax.hk worker →
Settings → Variables and Secrets**, as **Secret** type, on the environment that serves
matchmax.hk. Do not commit values, and do not paste them into a ticket or a screenshot.

Never set only the secret key: without the webhook secret the endpoint 400s and no order
ever leaves `awaiting_payment`, so the buyer is charged and gets nothing.

---

## 2. Stripe dashboard steps (test mode first)

1. Create or open the MatchMax Stripe account. Business country **Hong Kong**, currency
   **HKD**.
2. Stay in **test mode** for this phase.
3. **Developers → Webhooks → Add endpoint**
   - URL: `https://matchmax.hk/api/stripe/webhook`
   - Events, exactly these six:
     - `checkout.session.completed`
     - `checkout.session.async_payment_succeeded`
     - `checkout.session.expired`
     - `checkout.session.async_payment_failed`
     - `charge.succeeded`
     - `charge.updated`
   - `charge.succeeded` / `charge.updated` are what attach the **actual** Stripe fee
     used for the seller net (AC-543-2). Without them `gateway_fee_hkd` stays null and
     the seller net is overstated.
4. Copy the endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`, and the account's
   test secret key into `STRIPE_SECRET_KEY`.
5. Payment methods: card is always on. Turn on Apple Pay / AlipayHK / WeChat Pay only if
   the account actually supports them — the checkout does not name
   `payment_method_types`, so the dashboard decides which buttons appear (#784 §2.1).
6. Redeploy the worker so the new bindings are picked up.

---

## 3. Flag flip

`src/features/materials/marketplace-policy.ts:23` — flipped to `true` on 2026-11-27.

```ts
export const NOTES_OPTION_A_LIVE = true;
```

`SHOW_EARNINGS_BREAKDOWN` is derived from it (`:33`), so the seller breakdown on
`/account/notes/new` and the public 2% / 72h / Monday-FPS copy all turn on together.
There is no separate switch — that is deliberate, after PR #874 exposed the breakdown
while checkout was still dark.

**Flip order, same release:**

1. `NOTES_OPTION_A_LIVE = true`. ✅ done
2. Ship the #783 §2.1 copy checklist in the same release: `/guide/notes`, Help,
   TOS study-notes, Privacy (Stripe as processor + download logs), `/legal/notes-terms`,
   and the upload / checkout acknowledgements. Half-flipping shows 2% terms next to a
   20% cashier, which is the one thing #783 AC-544-1 forbids.
3. Tests that assert the flag is `false` must be updated in the same commit:
   `tests/materials/marketplace-policy.test.ts:154,168` and
   `tests/materials/seller-payout-breakdown.test.ts:6`.

## 4. Rollback

Set `NOTES_OPTION_A_LIVE` back to `false` and redeploy. The Stripe buy button disappears
and the FPS cashier resumes. Do **not** roll back by deleting the secrets: orders already
in `paid_held` still need the hourly sweep, and the sweep does not check the flag.

Existing paid Stripe orders keep releasing normally, because `sweepCheckoutHolds`
(`src/features/materials/checkout-v2.functions.ts:78`) only reads the order status.

## 5. Pre-cutover data requirements

A paid listing must not be sellable unless its seller can actually be paid.

- `seller_payout_details` currently has **0 rows**, while three published listings are
  priced above zero (HK$88, HK$98, HK$888). Publishing is gated for new listings
  (`src/features/materials/note-drafts.functions.ts:988` → `payout-gate.server`), but these
  predate the gate. Before the flag flips, each of those sellers must register FPS / bank
  details, or the listing must be unpublished. Otherwise MatchMax collects money it has
  no way to disburse, and the Monday FPS batch has nothing to pay against.
- The minimum paid price is HK$20 and the maximum HK$5,000
  (`marketplace-policy.ts:84`); HK$0 keeps its instant free grant and never touches
  Stripe.
- Payouts are manual, weekly Monday FPS, HK$50 minimum. Stripe Connect Express is
  explicitly **out of V1**.

## 6. Test-mode acceptance (maps to #784 ACs)

Run these before any live key is set. `docs/qa-option-a-checklist.md` covers the
non-payment surfaces; this is the money path.

| AC | Check |
| --- | --- |
| AC-543-1 | Buy a HK$88 note with `4242 4242 4242 4242`. Buyer is charged exactly HK$88, lands on `/orders/<id>?checkout=success`, downloads at once. Row is `paid_held` with `hold_expires_at = paid_at + 72h`. |
| AC-543-2 | `gateway_fee_hkd` equals the test charge's `balance_transaction.fee`; `platform_fee_hkd` = 2% of gross; `seller_net_payout_hkd` = gross − 2% − actual fee. No surcharge line on the buyer page. |
| AC-543-3 | Replay `checkout.session.completed` from the dashboard (Resend). Expect `already_processed`, one `sale_net` row, `sold_count` incremented once. |
| AC-543-4 | Abandon a session; after expiry the order stays `awaiting_payment` with `stripe_checkout_session_id` cleared, no charge, buyer can retry. |
| AC-543-5 | A HK$0 listing never opens Stripe and grants immediately. |
| AC-543-6 | Card declined (`4000 0000 0000 0002`) shows the bilingual unavailable/declined copy and leaves no paid order. |
| AC-543-7 | No tutoring tuition or matching fee is collected on this rail. |

Then verify the hourly task actually fires: `select status, hold_expires_at from
material_orders where id = '<order>'` should read `completed_released` after the 72h
mark, with one `sale_net` row in `seller_balance_entries`.

## 7. Live cutover

Only after a test-mode pass and ops approval:

1. Switch the Stripe account to live, create a **live-mode** webhook endpoint at the same
   URL with the same six events, and read its own `whsec_...`.
2. Replace both secrets with live values. Do not reuse the test-mode signing secret.
3. Flip the flag and ship the #783 copy in the same release.
4. Buy one real note yourself for the smallest amount, confirm the row, then refund it in
   Stripe and confirm `refunded` / the dispute path behaves.
