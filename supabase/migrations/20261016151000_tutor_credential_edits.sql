-- Issue #284 (P4) — Verified edits need evidence.
-- A tier_2_verified tutor cannot change a credential without a new document.
-- The old value stays public while the change is pending; staff approve
-- (swap the value in) or reject (keep the old value, store the reason).
--
-- ADDITIVE ONLY. Works WITH the existing locks instead of against them:
--   * tutors_owner_verified_guard (20261016110000/16120000) hard-locks
--     secondary_school / exam_results / achievements on the owner path for
--     verified tutors — the owner CANNOT write these columns directly. The
--     approved swap below runs as service role (BYPASSRLS), which the guard
--     explicitly allows, so no guard change is needed.
--   * Grade changes already have their own evidence flow (tutor_grades rows
--     with file_path + staff review, #309). This table covers the OTHER
--     credential fields: secondary_school, highschool, undergrad_*/postgrad_*
--     text fields, qualifications_summary, exam_results, achievements.
--
-- RLS follows the settled pattern (20261016120000): the owner gets SELECT
-- only; every mutation goes through service-role server fns, so a hand-rolled
-- PostgREST call can never self-approve an edit.

CREATE TABLE public.tutor_credential_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES public.tutors(id) ON DELETE CASCADE,
  field text NOT NULL CHECK (field IN (
    'secondary_school',
    'highschool',
    'undergrad_university',
    'undergrad_degree',
    'undergrad_graduation_year',
    'has_postgrad',
    'postgrad_university',
    'postgrad_degree',
    'qualifications_summary',
    'exam_results',
    'achievements'
  )),
  -- Snapshot of the public value at submit time (JSON, so jsonb fields and
  -- text fields share one shape). Staff compare old vs new side by side.
  old_value jsonb NOT NULL,
  new_value jsonb NOT NULL,
  evidence_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  staff_reason text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tutor_credential_edits IS
  'Issue #284: pending credential changes from verified tutors. The old value stays public until staff approve; evidence file lives in the private credential-evidence bucket.';

CREATE INDEX tutor_credential_edits_tutor_id_idx ON public.tutor_credential_edits (tutor_id);
CREATE INDEX tutor_credential_edits_pending_idx ON public.tutor_credential_edits (created_at ASC)
  WHERE status = 'pending';

-- One open edit per field: a second submit for the same field while one is
-- still pending replaces nothing — the app surfaces the pending state instead.
CREATE UNIQUE INDEX tutor_credential_edits_one_open_per_field
  ON public.tutor_credential_edits (tutor_id, field)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.tutor_credential_edits_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tutor_credential_edits_touch_updated_at
  BEFORE UPDATE ON public.tutor_credential_edits
  FOR EACH ROW EXECUTE FUNCTION public.tutor_credential_edits_touch_updated_at();

ALTER TABLE public.tutor_credential_edits ENABLE ROW LEVEL SECURITY;

-- Owner reads their own edits (pending state on the account page). No client
-- write policies: submit/approve/reject are service-role server fns only.
CREATE POLICY "Tutors read own credential edits"
  ON public.tutor_credential_edits
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tutors t
      WHERE t.id = tutor_credential_edits.tutor_id AND t.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Private storage bucket for the evidence files (same shape as grade-slips:
-- service-role only — uploads and staff signed URLs run through server fns).
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('credential-evidence', 'credential-evidence', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Service role manages credential evidence"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'credential-evidence')
  WITH CHECK (bucket_id = 'credential-evidence');
