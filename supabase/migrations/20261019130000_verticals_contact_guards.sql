-- Issue #190 back-end review fixes (PR #388):
--
-- 1. 20261017170000_sor_owner_column_freeze moved authenticated to an
--    explicit column SELECT grant on tutoring_cases and documented that new
--    columns must extend it. 20261019120000_verticals added academic_tier,
--    uni_field, uni_name, uni_program, uni_course_codes and
--    kindergarten_focus without extending the grant — the staff cases desk
--    (which selects those columns over the staff JWT) would hit permission
--    denied. Extended.
-- 2. university_courses / course_specific_grades keys are owner-writable
--    public text; the insert/owner contact guards did not scan them, so a
--    crafted owner UPDATE could land a phone/WhatsApp handle on the public
--    card. Both guards now scan the year-of-study string, the course tags
--    and the graded-course keys through the canonical
--    tutor_public_text_has_contact helper (same parity rule as #361/#376).

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
  kindergarten_focus
) ON public.tutoring_cases TO authenticated;

CREATE OR REPLACE FUNCTION public.tutors_insert_contact_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Do NOT skip service-role or staff. Go-live publishes with the service
  -- role (auth.uid() IS NULL), which the owner UPDATE guard ignores.
  IF public.tutor_public_text_has_contact(NEW.display_name)
    OR public.tutor_public_text_has_contact(NEW.headline)
    OR public.tutor_public_text_has_contact(NEW.self_introduction)
    OR public.tutor_public_text_has_contact(NEW.qualifications_summary)
    OR public.tutor_public_text_has_contact(NEW.academic_headline)
    OR public.tutor_public_text_has_contact(NEW.travel_note)
    OR public.tutor_public_text_has_contact(NEW.rate_note)
    OR public.tutor_public_text_has_contact(NEW.secondary_school)
    OR public.tutor_public_text_has_contact(NEW.undergrad_university)
    OR public.tutor_public_text_has_contact(NEW.undergrad_degree)
    OR public.tutor_public_text_has_contact(NEW.undergrad_graduation_year)
    OR public.tutor_public_text_has_contact(NEW.postgrad_university)
    OR public.tutor_public_text_has_contact(NEW.postgrad_degree)
    OR public.tutor_public_text_has_contact(NEW.university_year_of_study)
    OR EXISTS (
      SELECT 1
      FROM unnest(COALESCE(NEW.subjects, '{}'::text[])) AS item
      WHERE public.tutor_public_text_has_contact(item)
    )
    OR EXISTS (
      SELECT 1
      FROM unnest(COALESCE(NEW.languages, '{}'::text[])) AS item
      WHERE public.tutor_public_text_has_contact(item)
    )
    OR EXISTS (
      SELECT 1
      FROM unnest(COALESCE(NEW.stations, '{}'::text[])) AS item
      WHERE public.tutor_public_text_has_contact(item)
    )
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(NEW.rate_rows) = 'array' THEN NEW.rate_rows
          ELSE '[]'::jsonb
        END
      ) AS row
      WHERE public.tutor_public_text_has_contact(row->>'label')
    )
    -- Issue #190: university course tags + graded course keys are public.
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(NEW.university_courses) = 'array' THEN NEW.university_courses
          ELSE '[]'::jsonb
        END
      ) AS course
      WHERE public.tutor_public_text_has_contact(course #>> '{}')
    )
    OR EXISTS (
      SELECT 1
      FROM jsonb_object_keys(
        CASE
          WHEN jsonb_typeof(NEW.course_specific_grades) = 'object' THEN NEW.course_specific_grades
          ELSE '{}'::jsonb
        END
      ) AS graded
      WHERE public.tutor_public_text_has_contact(graded)
    )
  THEN
    RAISE EXCEPTION 'contact details are not allowed on the public card'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tutors_owner_contact_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  caller_is_staff boolean;
BEGIN
  caller_is_staff :=
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'staff');

  IF caller_is_staff OR auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  -- Full parity with tutors_insert_contact_guard (#361): every text value
  -- copied onto the public card is scanned by the canonical filter —
  -- emails, URLs/bare domains, HK-format and generic phone runs, and
  -- off-platform channel words on word boundaries. A false positive just
  -- asks the tutor to rephrase.
  IF public.tutor_public_text_has_contact(NEW.display_name)
    OR public.tutor_public_text_has_contact(NEW.headline)
    OR public.tutor_public_text_has_contact(NEW.self_introduction)
    OR public.tutor_public_text_has_contact(NEW.qualifications_summary)
    OR public.tutor_public_text_has_contact(NEW.academic_headline)
    OR public.tutor_public_text_has_contact(NEW.travel_note)
    OR public.tutor_public_text_has_contact(NEW.rate_note)
    OR public.tutor_public_text_has_contact(NEW.secondary_school)
    OR public.tutor_public_text_has_contact(NEW.undergrad_university)
    OR public.tutor_public_text_has_contact(NEW.undergrad_degree)
    OR public.tutor_public_text_has_contact(NEW.undergrad_graduation_year)
    OR public.tutor_public_text_has_contact(NEW.postgrad_university)
    OR public.tutor_public_text_has_contact(NEW.postgrad_degree)
    OR public.tutor_public_text_has_contact(NEW.university_year_of_study)
    OR EXISTS (
      SELECT 1
      FROM unnest(COALESCE(NEW.subjects, '{}'::text[])) AS item
      WHERE public.tutor_public_text_has_contact(item)
    )
    OR EXISTS (
      SELECT 1
      FROM unnest(COALESCE(NEW.languages, '{}'::text[])) AS item
      WHERE public.tutor_public_text_has_contact(item)
    )
    OR EXISTS (
      SELECT 1
      FROM unnest(COALESCE(NEW.stations, '{}'::text[])) AS item
      WHERE public.tutor_public_text_has_contact(item)
    )
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(NEW.rate_rows) = 'array' THEN NEW.rate_rows
          ELSE '[]'::jsonb
        END
      ) AS row
      WHERE public.tutor_public_text_has_contact(row->>'label')
    )
    -- Issue #190: university course tags + graded course keys are public.
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(NEW.university_courses) = 'array' THEN NEW.university_courses
          ELSE '[]'::jsonb
        END
      ) AS course
      WHERE public.tutor_public_text_has_contact(course #>> '{}')
    )
    OR EXISTS (
      SELECT 1
      FROM jsonb_object_keys(
        CASE
          WHEN jsonb_typeof(NEW.course_specific_grades) = 'object' THEN NEW.course_specific_grades
          ELSE '{}'::jsonb
        END
      ) AS graded
      WHERE public.tutor_public_text_has_contact(graded)
    )
  THEN
    RAISE EXCEPTION 'contact details are not allowed on the public card'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;
