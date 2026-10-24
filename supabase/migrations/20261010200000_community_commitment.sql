-- Issue #141: Airbnb-style community commitment shown once after account
-- creation (after onboarding role selection, before/alongside the ToS gate).
-- Records when the user agreed; decline signs them out (same as the ToS gate).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS community_commitment_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.community_commitment_at IS 'When the user agreed to the community commitment dialog (issue #141).';
