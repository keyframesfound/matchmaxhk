-- #784 AC-543-4: the 48-hour seller reply clock on a Stripe/escrow dispute.
-- Idempotent: the deploy may run before or after the code ships.
alter table public.material_orders
  add column if not exists dispute_seller_reply_due_at timestamptz,
  add column if not exists seller_responded_at timestamptz;

comment on column public.material_orders.dispute_seller_reply_due_at is
  '#784: dispute_opened_at + 48h; the seller reply clock. Staff see it on the orders desk.';
comment on column public.material_orders.seller_responded_at is
  '#784: when the seller of record confirmed a reply to the open dispute.';
