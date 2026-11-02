-- #543 / #573 open marketplace (trial): any signed-in user can sell notes
-- as a "Community Seller" without a tutor profile.
--
-- Mechanism: the seller gets a minimal tutors row (display_name +
-- tutor_code + user_id) flagged is_community_seller = true and kept
-- is_published = false, so it NEVER appears in the tutor directory (every
-- directory read filters is_published = true). Listings, orders and the
-- manual cashier flow keep their tutor_id foreign keys unchanged.
-- Additive and idempotent.

ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS is_community_seller boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tutors.is_community_seller IS
  '#573 open marketplace: notes-only seller row (no tutor card). Always is_published = false; readable publicly so their published notes can show the seller name.';

CREATE INDEX IF NOT EXISTS idx_tutors_community_seller_user
  ON public.tutors (user_id) WHERE is_community_seller = true;

-- Public can read community-seller rows (only display_name / tutor_code /
-- user_id are ever populated), so the shop join resolves the seller name.
DROP POLICY IF EXISTS "Public can view community sellers" ON public.tutors;
CREATE POLICY "Public can view community sellers"
  ON public.tutors FOR SELECT
  TO anon, authenticated
  USING (is_community_seller = true);

-- Published notes of community sellers are publicly readable too.
DROP POLICY IF EXISTS "Public can read published digital materials" ON public.digital_materials;
CREATE POLICY "Public can read published digital materials"
  ON public.digital_materials
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.tutors t
      WHERE t.id = digital_materials.tutor_id
        AND (t.is_published = true OR t.is_community_seller = true)
    )
  );
