-- #784 AC-543-4: the original 543 check only allowed the cashier rail
-- ('held' / 'delivered') while a dispute was open, and its status enum did not
-- include 'seller_responded'. The Stripe rail freezes as 'disputed_frozen'
-- (and can also stay paid_held/delivered_held), so widen both constraints.
alter table public.material_orders drop constraint if exists material_orders_dispute_open_live_chk;
alter table public.material_orders add constraint material_orders_dispute_open_live_chk
  check (dispute_status is distinct from 'open' or status in ('held','delivered','paid_held','delivered_held','disputed_frozen')) not valid;

alter table public.material_orders drop constraint if exists material_orders_dispute_status_check;
alter table public.material_orders add constraint material_orders_dispute_status_check
  check (dispute_status is null or dispute_status in ('open','seller_responded','refunded','rejected'));
