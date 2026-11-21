-- #784 §2.1: Stripe Checkout on the existing material_orders rail. Additive
-- except the released_reason check, which gains the value the checkout-v2
-- hold sweep already writes ('checkout_hold_expired').

alter table public.material_orders
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text;

create unique index if not exists material_orders_stripe_session_uq
  on public.material_orders (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists material_orders_stripe_pi_idx
  on public.material_orders (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

alter table public.material_orders drop constraint if exists material_orders_released_reason_check;
alter table public.material_orders add constraint material_orders_released_reason_check
  check (released_reason = any (array['buyer_confirmed', 'hold_expired', 'dispute_rejected', 'checkout_hold_expired']));

-- One sale_net ledger row per order (the hold sweep may run twice).
create unique index if not exists seller_balance_entries_sale_net_uq
  on public.seller_balance_entries (order_id)
  where kind = 'sale_net';
