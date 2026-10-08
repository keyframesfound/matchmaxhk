-- Issue #250 (acceptance groundwork, stacked on the #131-#134 marketplace MVP).
--
-- Two of #250's acceptance items cannot be enforced without an order record:
--   1. "A buyer cannot unlock a file without a delivered order."
--   2. "A zero-price grant does not appear in the tutor payout export."
--
-- This migration creates the minimal `material_orders` table in the shape
-- issue #203 (Notes shop Data section) specifies, so #203 extends it rather
-- than replacing it. It does NOT build #201/#203 features: no checkout UI,
-- no case-fee queue, no automatic FPS reconciliation.
--
-- #250's rule (Ryan): a staff grant is an order at HK$0, status delivered,
-- tutor_net 0, is_grant true — it exists so access and the payout export
-- have one source of truth, and it must never be paid out.

CREATE TABLE IF NOT EXISTS public.material_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.digital_materials(id) ON DELETE CASCADE,
  buyer_account_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tutor_id UUID NOT NULL REFERENCES public.tutors(id) ON DELETE CASCADE,

  -- #203 Money model. platform_fee = round(gross * 0.20); tutor_net = gross - fee.
  gross_hkd NUMERIC(10, 2) NOT NULL CHECK (gross_hkd >= 0),
  platform_fee_hkd NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (platform_fee_hkd >= 0),
  tutor_net_hkd NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (tutor_net_hkd >= 0),

  -- Full #203 status set so extending to real checkout needs no constraint
  -- migration. This groundwork only ever writes awaiting_payment/delivered.
  status TEXT NOT NULL DEFAULT 'awaiting_payment'
    CHECK (status IN (
      'awaiting_payment', 'paid', 'stamping',
      'delivered', 'stamp_failed', 'rejected', 'refunded'
    )),

  -- #250: staff grant marker. Grant rows are HK$0, delivered, tutor_net 0
  -- and are excluded from the payout export.
  is_grant BOOLEAN NOT NULL DEFAULT false,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  grant_reason TEXT,

  -- Manual cashier fields (#203): staff paste the FPS reference, mark paid,
  -- then release. delivered_by records which admin released the file.
  fps_reference TEXT,
  paid_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  delivered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- #203 acceptance: a second checkout of the same pack by the same buyer
  -- is blocked. A re-grant to someone who already holds an order is also
  -- blocked (they already have access).
  CONSTRAINT material_orders_material_buyer_unique UNIQUE (material_id, buyer_account_id)
);

COMMENT ON TABLE public.material_orders IS
  'Issue #250/#203 groundwork: one row per buyer per pack. The delivered status is the ONLY path to a signed URL for the private original (no order, no unlock). is_grant rows are HK$0 staff grants (tutor_net 0) and are excluded from the payout export. Checksum-free minimal slice: checkout UI, case linkage (#201) and statement batches (#203) land later.';

CREATE INDEX IF NOT EXISTS idx_material_orders_buyer
  ON public.material_orders (buyer_account_id, status);
CREATE INDEX IF NOT EXISTS idx_material_orders_tutor
  ON public.material_orders (tutor_id, status, delivered_at);
CREATE INDEX IF NOT EXISTS idx_material_orders_material
  ON public.material_orders (material_id);

ALTER TABLE public.material_orders ENABLE ROW LEVEL SECURITY;

-- Buyers see their own orders (that is how the library/download list works).
CREATE POLICY "Buyers can read own material orders"
  ON public.material_orders
  FOR SELECT
  TO authenticated
  USING (buyer_account_id = auth.uid());

-- Tutors see the orders on their own packs. The table holds no buyer contact
-- details (no phone/email/name — buyer_account_id is an opaque uuid), so the
-- #203 rule "tutor does not see who bought it" is not violated here.
CREATE POLICY "Tutors can read orders on own materials"
  ON public.material_orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tutors t
      WHERE t.id = material_orders.tutor_id AND t.user_id = auth.uid()
    )
  );

-- Admins read everything.
CREATE POLICY "Admins can read all material orders"
  ON public.material_orders
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Writes happen ONLY through server functions using the service-role client
-- (order creation, staff release, staff grant). No client INSERT/UPDATE/DELETE
-- policies on purpose: RLS silently blocks them all.

GRANT SELECT ON public.material_orders TO authenticated;
