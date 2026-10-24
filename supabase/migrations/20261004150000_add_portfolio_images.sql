-- Issue #97: Trophy Cabinet — public portfolio photo URLs on tutors.
-- text[] of public R2/CDN URLs; empty array = gallery hidden entirely.
ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS portfolio_images text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.tutors.portfolio_images IS
  'Issue #97: optional public portfolio / award photos (Trophy Cabinet). Empty array = gallery hidden; tutors keep full anonymity by leaving this unset.';
