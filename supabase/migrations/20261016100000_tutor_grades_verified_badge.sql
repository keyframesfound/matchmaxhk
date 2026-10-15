-- Issue #309 — grades with per-grade slip upload + one Verified badge from
-- approved grades. ADDITIVE ONLY:
--   * enum tutor_grade_status + table tutor_grades (tutor-owned rows, staff
--     review via service-role server fns — no client staff policies, same
--     pattern as the #308 account_blocklist reads).
--   * table tutor_notices (in-app notice to the tutor; inserts happen only
--     through the service role, tutors read/mark-read their own).
--   * private storage bucket `grade-slips` — service-role only, following the
--     materials-originals setup (no client policies = no authenticated path).
--   * tutors.approved_grade_labels kept in sync by trigger so public card
--     queries stay single-table and keep the tolerant pre-migration fallback.
--   * safe backfill: one tutor_grades row per distinct grade string found in
--     each tutor's existing exam_results jsonb, status='none'.

-- ---------------------------------------------------------------------------
-- tutor_grades
-- ---------------------------------------------------------------------------
CREATE TYPE public.tutor_grade_status AS ENUM ('none', 'pending', 'approved', 'rejected');

CREATE TABLE public.tutor_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES public.tutors(id) ON DELETE CASCADE,
  label text NOT NULL,
  status public.tutor_grade_status NOT NULL DEFAULT 'none',
  file_path text,
  staff_reason text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tutor_grades IS
  'Issue #309: per-grade result slips. label is public ONLY when status=approved; file_path stays private (grade-slips bucket, signed URLs via admin server fn).';

CREATE INDEX tutor_grades_tutor_id_idx ON public.tutor_grades (tutor_id);
CREATE INDEX tutor_grades_pending_idx ON public.tutor_grades (created_at ASC)
  WHERE status = 'pending';

-- updated_at touch
CREATE OR REPLACE FUNCTION public.tutor_grades_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tutor_grades_touch_updated_at
  BEFORE UPDATE ON public.tutor_grades
  FOR EACH ROW EXECUTE FUNCTION public.tutor_grades_touch_updated_at();

ALTER TABLE public.tutor_grades ENABLE ROW LEVEL SECURITY;

-- Tutor owns own rows (select/insert/update/delete) through the linked card.
CREATE POLICY "Tutors manage own grades"
  ON public.tutor_grades
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tutors t
      WHERE t.id = tutor_grades.tutor_id AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tutors t
      WHERE t.id = tutor_grades.tutor_id AND t.user_id = auth.uid()
    )
  );

-- Staff never get client policies: queue reads + signed slip URLs go through
-- admin-gated service-role server fns (issue #308 account_blocklist pattern).

-- ---------------------------------------------------------------------------
-- tutors.approved_grade_labels — trigger-maintained badge source
-- ---------------------------------------------------------------------------
ALTER TABLE public.tutors
  ADD COLUMN approved_grade_labels text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.tutors.approved_grade_labels IS
  'Issue #309: labels of approved tutor_grades rows; drives the Verified badge and the public card grade line. Never includes slip files.';

CREATE OR REPLACE FUNCTION public.refresh_tutor_approved_grades()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  affected_tutor uuid;
BEGIN
  affected_tutor := COALESCE(NEW.tutor_id, OLD.tutor_id);
  UPDATE public.tutors
  SET approved_grade_labels = COALESCE(
    (
      SELECT array_agg(label ORDER BY created_at)
      FROM public.tutor_grades
      WHERE tutor_id = affected_tutor AND status = 'approved'
    ),
    '{}'
  )
  WHERE id = affected_tutor;
  RETURN NULL;
END;
$$;

CREATE TRIGGER tutor_grades_refresh_approved_labels
  AFTER INSERT OR UPDATE OR DELETE ON public.tutor_grades
  FOR EACH ROW EXECUTE FUNCTION public.refresh_tutor_approved_grades();

-- ---------------------------------------------------------------------------
-- tutor_notices — minimal in-app notice (no WhatsApp, no email)
-- ---------------------------------------------------------------------------
CREATE TABLE public.tutor_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES public.tutors(id) ON DELETE CASCADE,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tutor_notices IS
  'Issue #309: one in-app notice per approve/reject; rendered as a banner in the tutor profile editor, deep-linking to the grade row.';

CREATE INDEX tutor_notices_tutor_id_idx ON public.tutor_notices (tutor_id, created_at DESC);

ALTER TABLE public.tutor_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tutors read own notices"
  ON public.tutor_notices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tutors t
      WHERE t.id = tutor_notices.tutor_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Tutors mark own notices read"
  ON public.tutor_notices
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tutors t
      WHERE t.id = tutor_notices.tutor_id AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tutors t
      WHERE t.id = tutor_notices.tutor_id AND t.user_id = auth.uid()
    )
  );

-- No INSERT policy: notices are created by the service-role review fn only.

-- ---------------------------------------------------------------------------
-- Storage: private grade-slips bucket (service-role only)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('grade-slips', 'grade-slips', false)
ON CONFLICT (id) DO NOTHING;

-- Only the service role touches slips (tutor uploads + staff signed URLs run
-- through server fns). No client-side policy = no authenticated write path.
CREATE POLICY "Service role manages grade slips"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'grade-slips')
  WITH CHECK (bucket_id = 'grade-slips');

-- ---------------------------------------------------------------------------
-- Backfill: one tutor_grades row per tutor per distinct grade string from the
-- existing exam_results jsonb ([{system, subjects:[{subject, grade}]}]).
-- status='none' — nothing becomes verified without staff review. Additive and
-- idempotent: rows are skipped when the same tutor already has that label.
-- ---------------------------------------------------------------------------
INSERT INTO public.tutor_grades (tutor_id, label, status)
SELECT
  tutor.id,
  entry.label,
  'none'::public.tutor_grade_status
FROM public.tutors tutor
CROSS JOIN LATERAL (
  SELECT DISTINCT trim(
    concat_ws(' ', subj->>'subject', subj->>'grade')
  ) AS label
  FROM jsonb_array_elements(COALESCE(tutor.exam_results, '[]'::jsonb)) res
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(res->'subjects') = 'array' THEN res->'subjects' ELSE '[]'::jsonb END
  ) AS subj
  WHERE trim(concat_ws(' ', subj->>'subject', subj->>'grade')) <> ''
  LIMIT 20
) entry
WHERE entry.label <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.tutor_grades existing
    WHERE existing.tutor_id = tutor.id AND existing.label = entry.label
  );
