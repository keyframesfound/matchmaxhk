-- Issues #55 + #81 (urgent sweep 2026-10-24): desk audit backfill + case applications.
--
-- 1. #55 audit gap: board-status changes made client-side (batch status
--    mutation, CaseDetailView status Select, MatchFeePanel markMatched)
--    bypassed case_audit — only SoR server-fn transitions wrote rows. A
--    SECURITY DEFINER trigger now writes audit rows for status changes made
--    under a user JWT (auth.uid() IS NOT NULL). Service-role writes are
--    skipped: server fns already write actor-attributed rows (insertAudit).
-- 2. #81: case_applications — the 1-click Apply-to-staff record (applications
--    never route to the parent). One per (case, tutor). RLS-deny; every
--    read/write goes through service-role server fns (SoR table pattern).
-- 3. Grant repair: who_for/student_gender (#437), compliance_triage/
--    compliance_note (#412) and the #423 package fields were added without
--    extending the authenticated column SELECT grant — the staff desk's
--    client query selects those columns and fails outright on prod.

-- ---------------------------------------------------------------------------
-- 1. Column-grant repair (extends 20261019130000_verticals_contact_guards).
--    Rule unchanged: WHEN ADDING A COLUMN, extend this grant.
-- ---------------------------------------------------------------------------
REVOKE SELECT ON public.tutoring_cases FROM authenticated;
GRANT SELECT (
  id, case_code, parent_id, title, description, subjects, exam_system,
  student_level, student_grade_current, student_school, district, mode,
  sessions_per_week, session_length_minutes, schedule_note, start_timing,
  preferred_gender, language_of_instruction, urgency, budget_min, budget_max,
  contact_name, contact_phone, status, tags, source, assigned_to,
  last_contacted_at, created_at, updated_at, board_published_at,
  requester_type, support_type, specific_component, target_pathway,
  target_school, interview_test, school_type, tutor_background,
  matched_tutor_id, matched_at, fee_collected_at, fee_amount_cents,
  budget_currency, budget_min_hkd, budget_max_hkd, sen_required,
  sen_categories, sen_details, organisation_id, concierge_id,
  replacement_of_case_id, sor_status, sor_status_at,
  academic_tier, uni_field, uni_name, uni_program, uni_course_codes,
  kindergarten_focus,
  who_for, student_gender,
  compliance_triage, compliance_note,
  package_type, student_count, rate_unit
) ON public.tutoring_cases TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. case_applications (#81)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.tutoring_cases(id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES public.tutors(id) ON DELETE CASCADE,
  account_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Optional short pitch from the tutor. Contact-filtered app-side; staff-only.
  note text CHECK (char_length(note) <= 500),
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewed', 'shortlisted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, tutor_id)
);
CREATE INDEX IF NOT EXISTS idx_case_applications_case
  ON public.case_applications (case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_applications_tutor
  ON public.case_applications (tutor_id, created_at DESC);
COMMENT ON TABLE public.case_applications IS
  '#81: 1-click tutor applications route to staff (never to the parent). RLS-deny; service-role server fns only.';

ALTER TABLE public.case_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.case_applications FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_applications TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Board-status audit trigger (#55). Client-side staff writes run under the
--    staff JWT, so auth.uid() attributes the actor; service-role writes are
--    server-fn territory and audit themselves.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.case_board_status_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND auth.uid() IS NOT NULL THEN
    INSERT INTO public.case_audit (case_id, actor_id, from_status, to_status)
    VALUES (NEW.id, auth.uid(), OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_case_board_status_audit ON public.tutoring_cases;
CREATE TRIGGER trg_case_board_status_audit
  AFTER UPDATE OF status ON public.tutoring_cases
  FOR EACH ROW EXECUTE FUNCTION public.case_board_status_audit();

REVOKE ALL ON FUNCTION public.case_board_status_audit() FROM PUBLIC, anon, authenticated;
