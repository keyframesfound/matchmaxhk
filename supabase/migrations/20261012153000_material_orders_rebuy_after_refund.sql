-- Issue #305 review fix: a REFUNDED order must not trap the (material,
-- buyer) pair forever — the buyer has to be able to re-purchase the same
-- note cleanly. The old table-wide UNIQUE constraint made any refunded row
-- a lifetime block on a fresh awaiting_payment order.
--
-- Replace it with a partial unique index: one NON-refunded order per
-- (material, buyer). Double-checkout stays impossible; staff grants (also
-- orders) keep their duplicate protection; only the dead refunded row is
-- exempt.

ALTER TABLE public.material_orders
  DROP CONSTRAINT IF EXISTS material_orders_material_buyer_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_material_orders_active_pair
  ON public.material_orders (material_id, buyer_account_id)
  WHERE status <> 'refunded';
