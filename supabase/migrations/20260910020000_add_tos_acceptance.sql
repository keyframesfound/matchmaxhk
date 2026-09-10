-- Track acceptance of the Terms of Service and Privacy Policy. A NULL
-- tos_accepted_at (including for legacy users) forces the acceptance gate
-- on next sign-in; tos_version records which revision was accepted so a
-- future terms update can re-prompt users by changing the expected version.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tos_version TEXT;

COMMENT ON COLUMN public.profiles.tos_accepted_at IS 'When the user accepted the Terms of Service and Privacy Policy.';
COMMENT ON COLUMN public.profiles.tos_version IS 'TOS revision the user accepted (effective date of the terms).';