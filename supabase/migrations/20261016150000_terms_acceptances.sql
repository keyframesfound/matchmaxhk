-- Issue #214 — Terms of Service updates.
-- Records WHICH terms version a user accepted on each gated surface and when.
-- ADDITIVE ONLY: new table + indexes + RLS. No changes to existing objects.
--
-- Surfaces (checked in app code, one row per acceptance click):
--   signup          — tutor application submit (/join)
--   note_upload     — note draft submit (/account/notes/new + edit)
--   checkout        — material order placement (/orders/$orderId)
--   referral_signup — tutor application submit that arrived via a referrer link
--
-- The version string lives in src/features/legal/terms.ts (TERMS_VERSION);
-- bumping it in code is what makes re-acceptance happen — this table only
-- stores what was accepted. RLS follows the #308/#309 service-role pattern:
-- the owner reads their own rows; inserts happen through the service-role
-- server fns that run the gates (no client INSERT policy = the gate cannot
-- be skipped with a hand-rolled request).

CREATE TABLE public.terms_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surface text NOT NULL CHECK (surface IN ('signup', 'note_upload', 'checkout', 'referral_signup')),
  terms_version text NOT NULL,
  subject_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.terms_acceptances IS
  'Issue #214: which terms version was accepted on which gated surface, and when. subject_id is the optional context row (application, note draft, or order).';

CREATE INDEX terms_acceptances_user_surface_idx
  ON public.terms_acceptances (user_id, surface, created_at DESC);
CREATE INDEX terms_acceptances_subject_idx
  ON public.terms_acceptances (subject_id)
  WHERE subject_id IS NOT NULL;

ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;

-- Owner reads their own acceptance history (settings / support surface).
CREATE POLICY "Users read own terms acceptances"
  ON public.terms_acceptances
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE client policies: acceptance rows are written by the
-- service-role server fns only after their gate validates the checkbox, so a
-- hand-rolled PostgREST call cannot record an acceptance it never made.
