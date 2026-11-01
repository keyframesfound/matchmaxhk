-- #573 Notes Marketplace Master SoT: Option A (seller net deduction),
-- D1-D9 disputes (D10 removed), negative-balance ledger, seller
-- declarations, upload scanner flags, richer download logs, strikes.
--
-- Additive and idempotent. Re-adds the material_orders status CHECK with
-- EVERY existing value (#203/#392/#429/#543) plus the #573 ones, so no live
-- row can violate it. Apply by hand before deploying the #573 code; Workers
-- Builds never applies migrations.

-- 1. Order state machine + Option A money columns ---------------------------
ALTER TABLE public.material_orders
  DROP CONSTRAINT IF EXISTS material_orders_status_check;
ALTER TABLE public.material_orders
  ADD CONSTRAINT material_orders_status_check CHECK (status IN (
    'awaiting_payment', 'paid', 'stamping',
    'in_fulfillment', 'past_due',
    'delivered', 'stamp_failed', 'rejected', 'refunded',
    'held', 'released', 'refunded_from_hold',
    'paid_held', 'disputed_frozen', 'completed_released',
    -- #573
    'delivered_held', 'refunded_full', 'refunded_less_fees'
  ));

ALTER TABLE public.material_orders
  -- gross - 2% platform fee - actual gateway fee (Option A).
  ADD COLUMN IF NOT EXISTS seller_net_payout_hkd numeric(10, 2),
  -- Negative-balance offset booked on a seller-fault refund / chargeback.
  ADD COLUMN IF NOT EXISTS seller_offset_hkd numeric(10, 2)
    CHECK (seller_offset_hkd IS NULL OR seller_offset_hkd >= 0),
  ADD COLUMN IF NOT EXISTS payout_batch_status text NOT NULL DEFAULT 'not_ready'
    CHECK (payout_batch_status IN (
      'not_ready', 'queued_for_monthly_payout', 'paid_out', 'offset_by_refund')),
  ADD COLUMN IF NOT EXISTS delivered_held_at timestamptz;

COMMENT ON COLUMN public.material_orders.seller_net_payout_hkd IS
  '#573 Option A: gross_hkd - ROUND(gross_hkd * platform_fee_pct / 100, 2) - gateway_fee_hkd (actual Stripe balance_transaction.fee / 100).';

-- 2. Disputes: D1-D9 reason codes + manager gate ---------------------------
ALTER TABLE public.material_disputes
  DROP CONSTRAINT IF EXISTS material_disputes_reason_check;
ALTER TABLE public.material_disputes
  ADD CONSTRAINT material_disputes_reason_check CHECK (reason IN (
    -- #543 slice-1 values, kept for any existing rows
    'corrupt_or_blank', 'materially_misrepresented', 'broken_external_link',
    -- #573: D1-D9 only (no D10)
    'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9'
  ));

ALTER TABLE public.material_disputes
  ADD COLUMN IF NOT EXISTS requires_manager_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manager_approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manager_approved_at timestamptz,
  -- D7: partial refund offered to the buyer; must be accepted within 24h.
  ADD COLUMN IF NOT EXISTS partial_offer_hkd numeric(10, 2),
  ADD COLUMN IF NOT EXISTS partial_offer_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS partial_accepted_at timestamptz;

-- Manager gate: any dispute on an order of HK$500 or more.
CREATE OR REPLACE FUNCTION public.material_disputes_manager_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  SELECT COALESCE(o.gross_hkd, 0) >= 500
    INTO NEW.requires_manager_approval
    FROM public.material_orders o
   WHERE o.id = NEW.order_id;
  NEW.requires_manager_approval := COALESCE(NEW.requires_manager_approval, false);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.material_disputes_manager_gate() FROM PUBLIC;

DROP TRIGGER IF EXISTS material_disputes_manager_gate ON public.material_disputes;
CREATE TRIGGER material_disputes_manager_gate
  BEFORE INSERT ON public.material_disputes
  FOR EACH ROW EXECUTE FUNCTION public.material_disputes_manager_gate();

-- 3. Seller payout settings: FPS / PayMe / AlipayHK + declarations ----------
ALTER TABLE public.seller_payout_details
  DROP CONSTRAINT IF EXISTS seller_payout_details_payout_method_check;
ALTER TABLE public.seller_payout_details
  ADD CONSTRAINT seller_payout_details_payout_method_check CHECK (payout_method IN (
    'fps_phone', 'fps_id', 'bank_account', 'payme', 'alipay_hk'));

ALTER TABLE public.seller_payout_details
  ADD COLUMN IF NOT EXISTS payme_link text
    CHECK (payme_link IS NULL OR char_length(payme_link) <= 200),
  ADD COLUMN IF NOT EXISTS alipay_hk_account text
    CHECK (alipay_hk_account IS NULL OR char_length(alipay_hk_account) <= 80),
  -- Optional payout QR image, private bucket path (never public).
  ADD COLUMN IF NOT EXISTS payout_qr_path text,
  ADD COLUMN IF NOT EXISTS is_seller_active boolean NOT NULL DEFAULT false;

ALTER TABLE public.seller_payout_details
  DROP CONSTRAINT IF EXISTS seller_payout_details_complete;
ALTER TABLE public.seller_payout_details
  ADD CONSTRAINT seller_payout_details_complete CHECK (
    (payout_method = 'fps_phone' AND fps_phone IS NOT NULL)
    OR (payout_method = 'fps_id' AND fps_id IS NOT NULL)
    OR (payout_method = 'bank_account' AND bank_account IS NOT NULL)
    OR (payout_method = 'payme' AND payme_link IS NOT NULL)
    OR (payout_method = 'alipay_hk' AND alipay_hk_account IS NOT NULL)
  );

-- Age + originality declarations (#573 seller activation), one row per
-- seller, timestamp + IP. Kept separate from payout details so a seller can
-- list a FREE item before registering a payout method.
CREATE TABLE IF NOT EXISTS public.seller_declarations (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  age_declared_at timestamptz NOT NULL,
  originality_declared_at timestamptz NOT NULL,
  declared_ip text,
  declared_user_agent text,
  terms_version text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.seller_declarations IS
  '#573: seller age (18+ or guardian consent) and originality / ban-list warranty, with timestamp + IP. Service-role only.';
ALTER TABLE public.seller_declarations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.seller_declarations FROM anon, authenticated;

-- 4. Seller balance ledger (negative balance offset) ------------------------
CREATE TABLE IF NOT EXISTS public.seller_balance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES public.material_orders(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN (
    'sale_net', 'refund_offset', 'chargeback_offset', 'payout', 'adjustment')),
  -- Signed: sale_net > 0; offsets and payouts < 0.
  amount_hkd numeric(10, 2) NOT NULL,
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seller_balance_entries_sign CHECK (
    (kind = 'sale_net' AND amount_hkd >= 0)
    OR (kind IN ('refund_offset', 'chargeback_offset', 'payout') AND amount_hkd <= 0)
    OR kind = 'adjustment'
  )
);
COMMENT ON TABLE public.seller_balance_entries IS
  '#573: append-only seller ledger. Available balance = SUM(amount_hkd) (may go negative). Retain 7 years (IRO Cap. 112 s.51C). Service-role only.';

-- One sale credit / one offset per order, so a retried job never double-posts.
CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_balance_entries_order_kind
  ON public.seller_balance_entries (order_id, kind)
  WHERE order_id IS NOT NULL AND kind IN ('sale_net', 'refund_offset', 'chargeback_offset');
CREATE INDEX IF NOT EXISTS idx_seller_balance_entries_user
  ON public.seller_balance_entries (user_id, created_at DESC);

ALTER TABLE public.seller_balance_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.seller_balance_entries FROM anon, authenticated;

-- Append-only: no UPDATE / DELETE, even for the service role's callers
-- through PostgREST (corrections are new 'adjustment' rows).
CREATE OR REPLACE FUNCTION public.seller_balance_entries_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'seller_balance_entries is append-only; post an adjustment instead'
    USING ERRCODE = 'P0001';
END;
$$;
DROP TRIGGER IF EXISTS seller_balance_entries_append_only ON public.seller_balance_entries;
CREATE TRIGGER seller_balance_entries_append_only
  BEFORE UPDATE OR DELETE ON public.seller_balance_entries
  FOR EACH ROW EXECUTE FUNCTION public.seller_balance_entries_append_only();

-- 5. Strikes on the user record (#559 / #573) -------------------------------
-- Not in the authenticated UPDATE column grant (account_status_column_freeze),
-- so users cannot change their own strike count.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS strike_count integer NOT NULL DEFAULT 0 CHECK (strike_count >= 0),
  ADD COLUMN IF NOT EXISTS moderation_notes text;

-- 6. Download log detail (#573: order, user, file, IP, UA, time, status) ---
ALTER TABLE public.material_download_logs
  ADD COLUMN IF NOT EXISTS file_id text,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS http_status integer;

-- 7. Upload scanner result on the listing -----------------------------------
ALTER TABLE public.digital_materials
  ADD COLUMN IF NOT EXISTS scan_status text NOT NULL DEFAULT 'not_scanned'
    CHECK (scan_status IN ('not_scanned', 'clean', 'flagged')),
  ADD COLUMN IF NOT EXISTS scan_flags text[] NOT NULL DEFAULT '{}';
