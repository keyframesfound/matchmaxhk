-- #375 review round — Back-end MERGE_BLOCKING 1 + 2 (grok web review @ 8540d64).
--
-- BE1: authenticated parents could mutate SoR/admin columns on their cases via
-- the legacy cases_owner_update policy (sor_status adopt through the guard's
-- NULL branch, fee_invoiced→fee_paid→active self-pay, hourly_rate_hkd /
-- matched_tutor_id rewrites). No client flow updates own cases — every
-- legitimate write is service_role (server fns) or admin/staff (the
-- cases_admin_all policy). Dropping the owner policy freezes ALL columns for
-- parent JWTs; the transition guard additionally tightens NULL→status adopt
-- to privileged writers as defence in depth.
--
-- BE2: cases_owner_select exposed admin-only columns (internal_note,
-- whatsapp_group_url, hourly_rate_hkd) to the owning parent over PostgREST.
-- Table-level SELECT is replaced with an explicit column grant; future columns
-- are NOT readable by authenticated until granted here (safe by default).
-- Admin users are also role `authenticated`, so admin client code must select
-- explicit columns (admin.cases.tsx does; select(*) is no longer usable).

-- ---------------------------------------------------------------------------
-- BE1: owner writes frozen
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS cases_owner_update ON public.tutoring_cases;

-- ---------------------------------------------------------------------------
-- Transition guard re-emission: NULL → status adopt requires a privileged
-- writer (service_role PostgREST request, trusted non-PostgREST context, or an
-- admin/super_admin/staff account). Legal-edge checks unchanged.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sor_case_transition_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  _allowed text[] := ARRAY[
    'draft->introduced', 'draft->closed',
    'introduced->lesson_1_scheduled', 'introduced->closed',
    'lesson_1_scheduled->lesson_1_done', 'lesson_1_scheduled->closed',
    'lesson_1_done->lesson_2_scheduled', 'lesson_1_done->fee_invoiced', 'lesson_1_done->closed',
    'lesson_2_scheduled->lesson_2_done', 'lesson_2_scheduled->closed',
    'lesson_2_done->fee_invoiced',
    'fee_invoiced->fee_paid', 'fee_invoiced->waived',
    'fee_paid->active',
    'active->replaced', 'active->closed',
    'waived->closed'
  ];
  _claim text;
  _privileged boolean;
BEGIN
  IF NEW.sor_status IS NULL OR NEW.sor_status = OLD.sor_status THEN
    RETURN NEW;
  END IF;
  IF OLD.sor_status IS NULL THEN
    -- NULL → status adopt is a SoR onboarding act: admins/staff (browser) or
    -- service_role (server fns) only. Non-PostgREST contexts (migrations, SQL
    -- editor) have no request.jwt.claim.role and are treated as trusted.
    _claim := current_setting('request.jwt.claim.role', true);
    _privileged := _claim IS NULL
      OR _claim = 'service_role'
      OR (
        auth.uid() IS NOT NULL
        AND (
          public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'super_admin')
          OR public.has_role(auth.uid(), 'staff')
        )
      );
    IF NOT _privileged THEN
      RAISE EXCEPTION 'sor_status adopt requires admin or service role'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;
  IF NOT (OLD.sor_status || '->' || NEW.sor_status) = ANY (_allowed) THEN
    RAISE EXCEPTION 'illegal case status transition % -> %', OLD.sor_status, NEW.sor_status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- BE2: column-level SELECT for authenticated (admin users included).
-- Kept readable: everything except internal_note, whatsapp_group_url,
-- hourly_rate_hkd. WHEN ADDING A COLUMN: extend this grant, and select
-- explicit columns in client code — select(*) breaks with column grants.
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
  replacement_of_case_id, sor_status, sor_status_at
) ON public.tutoring_cases TO authenticated;

-- ---------------------------------------------------------------------------
-- Trigger functions are not RPCs — revoke the default EXECUTE grants so they
-- cannot be called directly (default-privileges lesson from the gigs batch).
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.emit_case_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sor_case_transition_guard() FROM PUBLIC, anon, authenticated;

-- Back-end soft note: get_parent_review_summary has a wrong author filter and
-- no caller in src — close the anonymous/authenticated path until it is fixed
-- and actually used.
REVOKE ALL ON FUNCTION public.get_parent_review_summary(uuid) FROM PUBLIC, anon, authenticated;
