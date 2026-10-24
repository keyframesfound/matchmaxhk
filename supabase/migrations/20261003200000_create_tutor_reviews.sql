-- Issue #105 (schema) + #116 / #83 (display): verified tutor reviews.
--
-- Reviews are COLLECTED OFF-PLATFORM (concierge collects parent feedback after
-- the trial, per #83: "we will put those information manually to the tutor
-- profile if its good, if its bad we will not show it") and entered by ADMIN
-- in the Tutor Editor. No public/tutor write path.
--
-- Columns follow the #105 checklist, adapted to MatchMax's strict
-- last-name-only / anonymity model (confirmed with Ryan 2026-10-03):
--   reviewer_display_name  free text, e.g. "Mrs. Wong (Parent)" — admin-entered
--   student_grade_school   optional line, e.g. "Year 12, South Island School"
--   public_review          the testimonial text shown on the profile
--   rating                 1–5 stars
--   is_verified            always true on entry (concierge-verified source);
--                          kept from the #105 checklist for future intake forms
--   is_published           moderation gate — only published rows are publicly
--                          readable, and only for published tutors.
-- No aggregate average is shown publicly (list only).

CREATE TABLE IF NOT EXISTS public.tutor_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES public.tutors(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  public_review TEXT,
  reviewer_display_name TEXT NOT NULL,
  student_grade_school TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT true,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tutor_reviews IS
  'Issue #105/#83: admin-curated verified parent/student reviews shown on public tutor profiles. Admins write via RLS (has_role admin/super_admin); the public reads only published reviews of published tutors. No tutor or anon write path.';

CREATE INDEX IF NOT EXISTS idx_tutor_reviews_tutor_published
  ON public.tutor_reviews (tutor_id, created_at DESC)
  WHERE is_published = true;

ALTER TABLE public.tutor_reviews ENABLE ROW LEVEL SECURITY;

-- Public read: published reviews on published tutors only (anon + authenticated).
CREATE POLICY "Public can read published tutor reviews"
  ON public.tutor_reviews
  FOR SELECT
  TO anon, authenticated
  USING (
    is_published = true
    AND EXISTS (
      SELECT 1 FROM public.tutors t
      WHERE t.id = tutor_reviews.tutor_id AND t.is_published = true
    )
  );

-- Admins manage reviews from the Tutor Editor (same trust model as the tutors
-- table itself: authenticated admins via has_role; service role bypasses RLS).
CREATE POLICY "Admins can read all tutor reviews"
  ON public.tutor_reviews
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can insert tutor reviews"
  ON public.tutor_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND EXISTS (SELECT 1 FROM public.tutors t WHERE t.id = tutor_id)
  );

CREATE POLICY "Admins can update tutor reviews"
  ON public.tutor_reviews
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can delete tutor reviews"
  ON public.tutor_reviews
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

GRANT SELECT ON public.tutor_reviews TO anon, authenticated;
