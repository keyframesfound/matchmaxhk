-- Issue #429 (V1 core): escrow hold + seller-funded refunds on the notes shop.
--
-- CEO locks (2026-10-23): after staff release (delivery), MatchMax holds the
-- SELLER's net for 48 hours (72 for new sellers) or until the buyer taps
-- "Received / No issue". Refunds are SELLER-FUNDED ONLY: a valid dispute is
-- refunded 100% from the still-held funds, never from MatchMax corporate cash.
-- On a clean release MatchMax keeps 20% and the tutor receives 80% on the
-- normal (manual, monthly) FPS payout run; there is NO automated payout job —
-- the desk is the gate.
--
-- Additive only: three new statuses join the CHECK, plus hold/dispute/shop-
-- terms columns. No existing status, column or row is touched (live table was
-- empty at migration time; legacy 'delivered' rows keep their meaning — they
-- pre-date escrow and stay payable).
--
-- Money invariants (enforced in app code + tested in tests/materials):
--   full refund  -> refund_amount = gross, platform_fee 0, tutor_net 0
--   partial      -> fee = 20% of (gross - refunded), net = the rest
-- Payout payability: held = NOT payable; released / legacy delivered /
-- refunded_from_hold with net > 0 = payable (exportTutorPayoutCsv filters).

ALTER TABLE public.material_orders
  ADD COLUMN IF NOT EXISTS hold_until TIMESTAMPTZ,
  -- released_at + released_reason: buyer tapped Received (buyer_confirmed),
  -- the lazy sweep flipped an expired hold (hold_expired), or staff rejected
  -- a dispute (dispute_rejected). Legacy 'delivered' rows keep NULL.
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_reason TEXT
    CHECK (released_reason IN ('buyer_confirmed', 'hold_expired', 'dispute_rejected')),
  -- Buyer refund paid out of the STILL-HELD funds (seller-funded). Full = gross.
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10, 2)
    CHECK (refund_amount IS NULL OR refund_amount > 0),
  -- Staff dispute decision (refund or reject): who and when.
  ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- ONE dispute per order in V1: open -> refunded | rejected.
  ADD COLUMN IF NOT EXISTS dispute_status TEXT
    CHECK (dispute_status IS NULL OR dispute_status IN ('open', 'refunded', 'rejected')),
  ADD COLUMN IF NOT EXISTS dispute_reason TEXT
    CHECK (dispute_reason IS NULL OR dispute_reason IN (
      'file_defective', 'materially_different', 'not_as_described'
    )),
  ADD COLUMN IF NOT EXISTS dispute_detail TEXT,
  -- Optional evidence image in the PRIVATE orders-screenshots bucket
  -- (disputes/<order id>-<stamp>.<ext>), same pattern as the FPS proof.
  ADD COLUMN IF NOT EXISTS dispute_evidence_path TEXT,
  ADD COLUMN IF NOT EXISTS dispute_opened_at TIMESTAMPTZ,
  -- Checkout acknowledgment (#429 add-on 1): the buyer ticked the digital-
  -- goods / escrow checkbox; version + timestamp live ON THE ORDER ROW
  -- (no terms_acceptances CHECK surgery). Both set or both NULL.
  ADD COLUMN IF NOT EXISTS shop_terms_version TEXT,
  ADD COLUMN IF NOT EXISTS shop_terms_accepted_at TIMESTAMPTZ;

-- The escrow states join the lifecycle: delivered -> held (hold_until =
-- delivered_at + 48/72h) -> released | refunded_from_hold.
ALTER TABLE public.material_orders
  DROP CONSTRAINT IF EXISTS material_orders_status_check;
ALTER TABLE public.material_orders
  ADD CONSTRAINT material_orders_status_check
  CHECK (status IN (
    'awaiting_payment', 'paid', 'stamping',
    'in_fulfillment', 'past_due',
    'delivered', 'stamp_failed', 'rejected', 'refunded',
    'held', 'released', 'refunded_from_hold'
  ));

-- State/timestamp coherence for the NEW states only (legacy rows all NULL).
ALTER TABLE public.material_orders
  DROP CONSTRAINT IF EXISTS material_orders_escrow_coherent;
ALTER TABLE public.material_orders
  ADD CONSTRAINT material_orders_escrow_coherent CHECK (
    (status <> 'held' OR hold_until IS NOT NULL)
    AND (status <> 'released' OR released_at IS NOT NULL)
    AND (
      status <> 'refunded_from_hold'
      OR (refund_amount IS NOT NULL AND decided_at IS NOT NULL)
    )
    AND (
      (shop_terms_version IS NULL AND shop_terms_accepted_at IS NULL)
      OR (shop_terms_version IS NOT NULL AND shop_terms_accepted_at IS NOT NULL)
    )
    AND (
      (dispute_status IS NULL AND dispute_opened_at IS NULL)
      OR (dispute_status IS NOT NULL AND dispute_opened_at IS NOT NULL)
    )
    AND (
      dispute_status IS NULL
      OR dispute_status = 'open'
      OR decided_at IS NOT NULL
    )
  );

-- Lazy hold-expiry sweep (no cron — the desk is the gate, #328 pattern):
-- reads flip held rows past their hold_until to released/hold_expired.
CREATE INDEX IF NOT EXISTS idx_material_orders_hold_sweep
  ON public.material_orders (hold_until)
  WHERE status = 'held';

COMMENT ON COLUMN public.material_orders.hold_until IS
  '#429: seller funds held until this instant (delivered_at + 48h, or 72h for new sellers: fewer than 3 delivered orders or first delivery within 14 days). Held rows are NOT payable.';
COMMENT ON COLUMN public.material_orders.refund_amount IS
  '#429: amount refunded to the buyer FROM THE HELD FUNDS (seller-funded). MatchMax keeps 20% only of the non-refunded portion; a 100% refund leaves platform fee 0 and tutor net 0. Never paid from corporate cash.';
