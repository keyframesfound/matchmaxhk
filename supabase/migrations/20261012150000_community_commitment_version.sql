-- Issue #306: version the community commitment — re-prompt on version change.
-- `community_commitment_at` already exists (20261010200000); this adds the
-- version column the gate reads/writes (features/auth/commitment-version.ts).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS community_commitment_version TEXT;

COMMENT ON COLUMN public.profiles.community_commitment_version IS 'Version of the community commitment the user agreed to (issue #306). NULL = agreed before versioning; treated as version "1".';
