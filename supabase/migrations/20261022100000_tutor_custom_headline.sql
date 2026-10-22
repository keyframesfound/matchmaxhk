-- Issue #411: dual-language custom headline (EN + ZH) on tutor cards.
-- Adds custom_headline_en / custom_headline_zh (<= 60 chars each), backfills
-- EN from the existing derived academic_headline, seeds EN on future profile
-- creation, and adds both public-text columns to the owner/insert contact
-- guards (headlines are owner-editable self-reported copy -- covered by the
-- Self-Reported pill, NOT credential-locked).

ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS custom_headline_en text,
  ADD COLUMN IF NOT EXISTS custom_headline_zh text;

ALTER TABLE public.tutors
  ADD CONSTRAINT tutors_custom_headline_en_max60
    CHECK (custom_headline_en IS NULL OR char_length(custom_headline_en) <= 60),
  ADD CONSTRAINT tutors_custom_headline_zh_max60
    CHECK (custom_headline_zh IS NULL OR char_length(custom_headline_zh) <= 60);

-- Retro-fill for existing profiles. Only copy when it fits the 60-char cap;
-- longer legacy headlines stay NULL and the UI falls back to academic_headline.
UPDATE public.tutors
SET custom_headline_en = NULLIF(btrim(academic_headline), '')
WHERE custom_headline_en IS NULL
  AND academic_headline IS NOT NULL
  AND btrim(academic_headline) <> ''
  AND char_length(btrim(academic_headline)) <= 60;

-- Pre-fill on profile creation: copy the academic headline the publish path
-- writes, so new cards are never blank (issue #411 "pre-filled upon creation").
CREATE OR REPLACE FUNCTION public.tutors_seed_custom_headline()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NEW.custom_headline_en IS NULL
     AND NEW.academic_headline IS NOT NULL
     AND btrim(NEW.academic_headline) <> ''
     AND char_length(btrim(NEW.academic_headline)) <= 60 THEN
    NEW.custom_headline_en := NULLIF(btrim(NEW.academic_headline), '');
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_tutors_seed_custom_headline ON public.tutors;
CREATE TRIGGER trg_tutors_seed_custom_headline
  BEFORE INSERT ON public.tutors
  FOR EACH ROW EXECUTE FUNCTION public.tutors_seed_custom_headline();

-- Contact guards: the two new headline columns are owner-editable public text,
-- so both guards must run them through tutor_public_text_has_contact.
CREATE OR REPLACE FUNCTION public.tutors_insert_contact_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.tutor_public_text_has_contact(NEW.display_name)
    OR public.tutor_public_text_has_contact(NEW.headline)
    OR public.tutor_public_text_has_contact(NEW.custom_headline_en)
    OR public.tutor_public_text_has_contact(NEW.custom_headline_zh)
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

  IF public.tutor_public_text_has_contact(NEW.display_name)
    OR public.tutor_public_text_has_contact(NEW.headline)
    OR public.tutor_public_text_has_contact(NEW.custom_headline_en)
    OR public.tutor_public_text_has_contact(NEW.custom_headline_zh)
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
