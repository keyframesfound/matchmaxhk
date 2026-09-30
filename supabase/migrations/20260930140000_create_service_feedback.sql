-- Issue #148: platform-level service quality feedback (not tutor reviews).
-- One row per submission; `role` is tagged at insert time from the Screen 1
-- identity choice (parent_student | tutor) so admin can route/filter.
-- The form is public (pre-login parents use it too), so anon gets INSERT only
-- with Turnstile handled at the route level like other public forms.

CREATE TABLE IF NOT EXISTS public.service_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('parent_student', 'tutor')),
  speed_rating INTEGER NOT NULL CHECK (speed_rating BETWEEN 1 AND 5),
  smoothness_rating INTEGER NOT NULL CHECK (smoothness_rating BETWEEN 1 AND 5),
  service_rating INTEGER NOT NULL CHECK (service_rating BETWEEN 1 AND 5),
  top_concern TEXT NOT NULL,
  additional_comments TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  locale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.service_feedback IS
  'Issue #148: MatchMax service quality feedback. Role-tagged (parent_student | tutor); ratings 1-5. Not tutor reviews.';

ALTER TABLE public.service_feedback ENABLE ROW LEVEL SECURITY;

-- Anon + authenticated can submit; nobody reads via the client — admins use
-- the service role / Supabase studio. No SELECT policies on purpose.
CREATE POLICY "Anyone can submit service feedback"
  ON public.service_feedback
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    role IN ('parent_student', 'tutor')
    AND speed_rating BETWEEN 1 AND 5
    AND smoothness_rating BETWEEN 1 AND 5
    AND service_rating BETWEEN 1 AND 5
    AND length(top_concern) BETWEEN 1 AND 500
  );

GRANT INSERT ON public.service_feedback TO anon, authenticated;
REVOKE ALL ON public.service_feedback FROM anon, authenticated EXCEPT INSERT;
