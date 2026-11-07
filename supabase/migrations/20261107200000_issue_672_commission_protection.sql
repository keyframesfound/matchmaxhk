-- Issue #672 — commission protection rules.
--
-- 1. commission_credits: MatchMax Commission Credit issued to a tutor when a
--    parent-fault stop inside the Lessons 2–4 window (within 28 days of
--    Lesson 1) leaves them over-collected relative to the #672 cap
--    max(0.5 lesson, 20% of completed lessons). Credits auto-apply 100%
--    against the tutor's NEXT case commission; there is no cash payout —
--    cash exceptions stay a manual admin action.
-- 2. profiles.early_termination_count: parent reliability counter bumped
--    when a parent/centre initiates a termination inside Lessons 1–4
--    without verified tutor fault (pairs with the dual-rating prompt).
--
-- Posture convention: RLS enabled, no policies, zero grants — writes and
-- reads go through service-role server fns only (drop-protection desk).

CREATE TABLE IF NOT EXISTS public.commission_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES public.tutors(id) ON DELETE CASCADE,
  source_case_id uuid REFERENCES public.tutoring_cases(id) ON DELETE SET NULL,
  amount_hkd numeric(10, 2) NOT NULL CHECK (amount_hkd > 0),
  -- Rule snapshot at issue time so later engine changes never rewrite history.
  rule_id text NOT NULL,
  adjusted_fee_hkd numeric(10, 2) NOT NULL CHECK (adjusted_fee_hkd >= 0),
  collected_hkd numeric(10, 2) NOT NULL CHECK (collected_hkd >= 0),
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'applied', 'voided')),
  applied_case_id uuid REFERENCES public.tutoring_cases(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.commission_credits IS
  '#672: MatchMax Commission Credit from Lessons 2–4 parent-fault stops. Auto-applied against the next case commission; never a cash payout.';

CREATE INDEX IF NOT EXISTS idx_commission_credits_tutor_status
  ON public.commission_credits (tutor_id)
  WHERE status = 'available';

-- One drop decision per case: a re-save corrects the credit in place.
CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_credits_source_case
  ON public.commission_credits (source_case_id)
  WHERE source_case_id IS NOT NULL;

ALTER TABLE public.commission_credits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.commission_credits FROM anon, authenticated;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS early_termination_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.early_termination_count IS
  '#672: parent/centre-initiated terminations inside Lessons 1–4 without verified tutor fault.';
