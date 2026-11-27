-- #783 §2.3 / #717: log of "3 tutors with open slots" suggestion emails.
-- One row per send: who, which subject, which 3 tutors. Drives the 14-day
-- per-parent cadence and the 30-day no-repeat-tutor rule. Service role only.
CREATE TABLE IF NOT EXISTS public.tutor_suggestion_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 120),
  curriculum text CHECK (curriculum IS NULL OR char_length(curriculum) <= 60),
  tutor_ids uuid[] NOT NULL CHECK (cardinality(tutor_ids) = 3),
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_suggestion_email_log_user
  ON public.tutor_suggestion_email_log (user_id, sent_at DESC);

ALTER TABLE public.tutor_suggestion_email_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tutor_suggestion_email_log FROM anon, authenticated;
GRANT SELECT, INSERT ON public.tutor_suggestion_email_log TO service_role;

COMMENT ON TABLE public.tutor_suggestion_email_log IS
  '#717 / #783 §2.3: tutor suggestion emails sent (14-day cadence, 30-day tutor de-dupe). Service-role only.';
