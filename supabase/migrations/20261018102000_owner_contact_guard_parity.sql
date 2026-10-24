-- Issue #361 items 2-3: owners' UPDATE contact guard parity + phantom
-- column fix (part of the 2026-10-18 hardening batch).
--
-- Two problems with the previous tutors_owner_contact_guard:
--   1. Its field array referenced NEW.bio and NEW.academic_summary — neither
--      column exists on the live tutors table (verified 2026-10-18 via
--      information_schema), so any owner UPDATE (non-staff, user_id =
--      auth.uid()) raised `record "new" has no field` at runtime.
--   2. It scanned only 5 of the card's text columns with an inline regex
--      copy, while tutors_insert_contact_guard (the INSERT gate from #360)
--      scans the full set through the canonical tutor_public_text_has_contact
--      helper. Owner profile edits could land contact details in
--      travel_note / rate_note / school fields / subjects / languages /
--      stations / rate-row labels.
--
-- This rewrite delegates to the same helper over the same field set as the
-- INSERT guard, keeping the staff / service-role / owner early-outs.
-- CREATE OR REPLACE keeps the existing trigger binding intact.
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
  THEN
    RAISE EXCEPTION 'contact details are not allowed on the public card'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;
