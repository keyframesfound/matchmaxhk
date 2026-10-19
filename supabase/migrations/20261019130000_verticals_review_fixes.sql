-- Issue #190 review fixes (grok front-end/back-end REQUEST_CHANGES triage).
--
-- 1. tutoring_cases: the 20261017170000 column freeze left `authenticated`
--    on an explicit column SELECT grant with the instruction "WHEN ADDING A
--    COLUMN: extend this grant". 20261019120000_verticals added the six
--    vertical columns without extending it, so the staff-JWT admin desk
--    (which selects them explicitly) got permission denied / empty desk.
-- 2. Contact-guard parity: university_courses (jsonb array of course tags)
--    and course_specific_grades (jsonb map course -> grade) are owner-
--    writable public free text but were not scanned by the two tutor contact
--    guards — a crafted owner UPDATE could put a phone/WhatsApp handle on
--    the public card via a course tag. Both guards now scan the array
--    elements and the grade-map KEYS (values are the canonical grade vocab).
--    Same jsonb_typeof hardening pattern as the rate_rows scan.

-- ---------------------------------------------------------------------------
-- 1. Extend the authenticated column SELECT grant (freeze-migration rule).
-- ---------------------------------------------------------------------------
GRANT SELECT (
  academic_tier, uni_field, uni_name, uni_program, uni_course_codes,
  kindergarten_focus
) ON public.tutoring_cases TO authenticated;

-- ---------------------------------------------------------------------------
-- 2a. Owner UPDATE guard — full field list from 20261018102000 plus the two
--     new jsonb scans.
-- ---------------------------------------------------------------------------
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
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(NEW.university_courses) = 'array' THEN NEW.university_courses
          ELSE '[]'::jsonb
        END
      ) AS item
      WHERE public.tutor_public_text_has_contact(item)
    )
    OR EXISTS (
      SELECT 1
      FROM jsonb_object_keys(
        CASE
          WHEN jsonb_typeof(NEW.course_specific_grades) = 'object' THEN NEW.course_specific_grades
          ELSE '{}'::jsonb
        END
      ) AS key
      WHERE public.tutor_public_text_has_contact(key)
    )
  THEN
    RAISE EXCEPTION 'contact details are not allowed on the public card'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2b. INSERT guard — full field list from 20261015230000 plus the two new
--     jsonb scans. Does NOT skip service-role or staff (go-live publishes
--     with the service role).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tutors_insert_contact_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
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
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(NEW.university_courses) = 'array' THEN NEW.university_courses
          ELSE '[]'::jsonb
        END
      ) AS item
      WHERE public.tutor_public_text_has_contact(item)
    )
    OR EXISTS (
      SELECT 1
      FROM jsonb_object_keys(
        CASE
          WHEN jsonb_typeof(NEW.course_specific_grades) = 'object' THEN NEW.course_specific_grades
          ELSE '{}'::jsonb
        END
      ) AS key
      WHERE public.tutor_public_text_has_contact(key)
    )
  THEN
    RAISE EXCEPTION 'contact details are not allowed on the public card'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Trigger functions are not RPCs (default-privileges lesson from the gigs
--    batch). CREATE OR REPLACE preserves existing grants; re-assert the
--    revokes so the functions can never be called directly.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.tutors_owner_contact_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tutors_insert_contact_guard() FROM PUBLIC, anon, authenticated;
