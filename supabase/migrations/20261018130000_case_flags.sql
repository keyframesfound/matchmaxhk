-- Issue #254 (F3): staff case flags. Staff can flag a case (intro used,
-- fee unpaid, parties continued, off-site request before the fee, tutor
-- shared contact details). A flag stores actor, reason, note, and time.
-- A flag never auto-charges, never reads any messages, and never invents
-- a fine — invoice / waive / ban remain manual staff actions (#259, #376).
--
-- Access: service-role only. The desk reads flags through
-- listCaseFlags/getDeskCase (assertAdmin server fns), so the table gets
-- RLS with no policies and no grants for client roles — same posture as
-- tutor_ghost_strikes.

CREATE TABLE IF NOT EXISTS public.case_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.tutoring_cases(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_name text,
  reason text NOT NULL CHECK (reason IN (
    'intro_used',
    'fee_unpaid',
    'parties_continued',
    'off_site_request',
    'tutor_shared_contact'
  )),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_flags_case
  ON public.case_flags (case_id, created_at DESC);

ALTER TABLE public.case_flags ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.case_flags FROM anon, authenticated;

COMMENT ON TABLE public.case_flags IS
  'Issue #254: staff flags on a case (actor, reason, note, time). Service-role writes/reads only — surfaced through admin desk server fns.';
