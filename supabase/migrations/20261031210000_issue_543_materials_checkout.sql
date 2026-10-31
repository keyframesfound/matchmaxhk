-- Issue #543: automated materials checkout groundwork.
--
-- This slice is deliberately backward-compatible with the live #203/#429
-- manual-cashier flow: it extends the order state machine with the #543
-- checkout statuses, adds the hold-money columns, and creates the
-- immutable evidence + payout tables the Stripe path (next slice) writes.
-- Nothing here changes how the current 20% cashier flow computes fees:
-- platform_fee_pct is a per-order SNAPSHOT (legacy rows keep 20; the Stripe
-- path writes 2 per the #543 fee lock).
--
-- #543 locks honoured: 72h hold from paid_at (not delivery), disputes only
-- inside the window, no refunds after release, download evidence logging.

-- 1. Order state machine + hold-money snapshot columns.
-- The live CHECK (verified 2026-10-31 on prod) carries 12 statuses from the
-- #203/#392/#429 flow; this re-adds ALL of them plus the three #543 ones —
-- dropping and re-adding with a shorter list would break the gig flow.
ALTER TABLE public.material_orders
  DROP CONSTRAINT IF EXISTS material_orders_status_check;
ALTER TABLE public.material_orders
  ADD CONSTRAINT material_orders_status_check CHECK (status IN (
    'awaiting_payment', 'paid', 'stamping',
    'in_fulfillment', 'past_due',
    'delivered', 'stamp_failed', 'rejected', 'refunded',
    -- #429 hold world (legacy rows).
    'held', 'released', 'refunded_from_hold',
    -- #543 checkout world: paid → held → released; disputes freeze.
    'paid_held', 'disputed_frozen', 'completed_released'
  ));

ALTER TABLE public.material_orders
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS hold_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS platform_fee_pct numeric(5, 2)
    CHECK (platform_fee_pct IS NULL OR (platform_fee_pct >= 0 AND platform_fee_pct <= 100)),
  ADD COLUMN IF NOT EXISTS platform_fee_hkd numeric(10, 2),
  ADD COLUMN IF NOT EXISTS gateway_fee_hkd numeric(10, 2);

COMMENT ON COLUMN public.material_orders.platform_fee_pct IS
  '#543: per-order snapshot of the MatchMax platform fee percent (2 for Stripe checkout orders; legacy cashier rows stay at their 20-era value).';

CREATE INDEX IF NOT EXISTS idx_material_orders_hold_release
  ON public.material_orders (hold_expires_at)
  WHERE status = 'paid_held';

-- 2. Immutable download evidence (#543 §3.C.3): every signed-URL grant is
-- one row; admin dispute reviews read this instead of trusting either party.
CREATE TABLE IF NOT EXISTS public.material_download_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.material_orders(id) ON DELETE CASCADE,
  buyer_account_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.digital_materials(id) ON DELETE SET NULL,
  signed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.material_download_logs IS
  '#543: one immutable row per download grant (15-minute signed URL). Proves buyer access in disputes.';
ALTER TABLE public.material_download_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.material_download_logs FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_material_download_logs_order
  ON public.material_download_logs (order_id, signed_at DESC);

-- 3. Structured disputes (#543 §3.D): only inside the 72h window; admin
-- resolves to refund or release.
CREATE TABLE IF NOT EXISTS public.material_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.material_orders(id) ON DELETE CASCADE,
  opened_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN (
    'corrupt_or_blank', 'materially_misrepresented', 'broken_external_link')),
  evidence_note text NOT NULL CHECK (char_length(evidence_note) BETWEEN 10 AND 2000),
  status text NOT NULL DEFAULT 'opened'
    CHECK (status IN ('opened', 'seller_responded', 'resolved_refunded', 'resolved_released')),
  seller_response_note text CHECK (seller_response_note IS NULL OR char_length(seller_response_note) <= 2000),
  seller_responded_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolution_note text CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.material_disputes IS
  '#543 §D: disputes allowed only while now() < hold_expires_at; an open dispute freezes auto-release.';
ALTER TABLE public.material_disputes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.material_disputes FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_material_disputes_open
  ON public.material_disputes (order_id)
  WHERE status IN ('opened', 'seller_responded');

-- 4. Seller payout registration (#543 §A.5): private FPS receiving details,
-- required before publishing a paid listing in the Stripe world. Never
-- exposed publicly; service-role only like students/ledger.
CREATE TABLE IF NOT EXISTS public.seller_payout_details (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payout_method text NOT NULL CHECK (payout_method IN ('fps_phone', 'fps_id', 'bank_account')),
  fps_phone text CHECK (fps_phone IS NULL OR fps_phone ~ '^[2-9][0-9]{7}$'),
  fps_id text CHECK (fps_id IS NULL OR char_length(fps_id) <= 30),
  bank_account text CHECK (bank_account IS NULL OR char_length(bank_account) BETWEEN 8 AND 24),
  payee_name text NOT NULL CHECK (char_length(payee_name) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seller_payout_details_complete CHECK (
    (payout_method = 'fps_phone' AND fps_phone IS NOT NULL)
    OR (payout_method = 'fps_id' AND fps_id IS NOT NULL)
    OR (payout_method = 'bank_account' AND bank_account IS NOT NULL)
  )
);

COMMENT ON TABLE public.seller_payout_details IS
  '#543 §A.5: private HK FPS receiving details for the weekly batch payout. Bank rows need the legal payee name; never shown publicly.';
ALTER TABLE public.seller_payout_details ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.seller_payout_details FROM anon, authenticated;

-- 5. Open-marketplace listing fields (#543 §A + addendum): creator alias,
-- listing kind, and the group-class addendum fields.
ALTER TABLE public.digital_materials
  ADD COLUMN IF NOT EXISTS creator_display_name text
    CHECK (creator_display_name IS NULL OR char_length(creator_display_name) <= 60),
  ADD COLUMN IF NOT EXISTS listing_kind text NOT NULL DEFAULT 'digital_file'
    CHECK (listing_kind IN ('digital_file', 'group_class')),
  ADD COLUMN IF NOT EXISTS class_start_date timestamptz,
  ADD COLUMN IF NOT EXISTS location_or_zoom text
    CHECK (location_or_zoom IS NULL OR char_length(location_or_zoom) <= 300),
  ADD COLUMN IF NOT EXISTS max_seats integer
    CHECK (max_seats IS NULL OR (max_seats >= 1 AND max_seats <= 500)),
  ADD COLUMN IF NOT EXISTS enrolled_seats integer NOT NULL DEFAULT 0
    CHECK (enrolled_seats >= 0);

COMMENT ON COLUMN public.digital_materials.creator_display_name IS
  '#543 §A.2: optional public alias (e.g. "HKU Year 1 Medical Student"); the seller badge stays derived from real tutor/centre status.';
COMMENT ON COLUMN public.digital_materials.listing_kind IS
  '#543 addendum: digital_file downloads vs group_class e-ticket enrolments.';
