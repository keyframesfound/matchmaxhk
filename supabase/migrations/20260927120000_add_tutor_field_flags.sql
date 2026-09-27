-- Issue #125: granular per-field approval/flagging for tutor profiles.
--
-- tutors.field_flags is the flagged-field registry: one key per hidden field,
-- value { "at": <iso timestamp> } for audit. It is intentionally note-free —
-- the internal admin notes live in tutor_field_flags below, because the
-- public "Public can view published tutors" policy exposes every column of a
-- published tutors row to anon, and these notes must stay internal (Tim
-- relays them to the tutor over WhatsApp himself).
--
-- Flag semantics (see src/features/tutors/field-flags.ts for the canonical
-- field list):
--   - Flagging any field hides only that field from public surfaces; the
--     profile stays live (public fetchers strip flagged values).
--   - Flagging a crucial field (name, photo, undergrad_university,
--     undergrad_degree) forces the whole profile to Hidden / Action Required
--     (the admin editor refuses to publish while one is active).

ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS field_flags JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.tutors.field_flags IS
  'Issue #125: flagged profile fields hidden from public surfaces. Key per field, value { "at": iso }; empty object means every field is approved. Internal notes are NOT stored here (see tutor_field_flags).';

CREATE TABLE IF NOT EXISTS public.tutor_field_flags (
  tutor_id UUID NOT NULL REFERENCES public.tutors(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tutor_id, field)
);

COMMENT ON TABLE public.tutor_field_flags IS
  'Issue #125: internal admin notes per flagged tutor profile field. Admin/super_admin only — never exposed to anon.';

ALTER TABLE public.tutor_field_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage tutor field flag notes"
  ON public.tutor_field_flags
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

GRANT ALL ON public.tutor_field_flags TO authenticated;
REVOKE ALL ON public.tutor_field_flags FROM anon;

-- Case matching must honor the same field-level hiding as the profile pages:
-- matched-tutor rows are rendered for parents, so flagged values are nulled
-- in the output (column shapes unchanged). Scoring keeps using the real
-- stored values so matching quality is unaffected by display flags.
CREATE OR REPLACE FUNCTION public.match_tutors_for_case(_case_id uuid, _limit integer DEFAULT 5)
RETURNS TABLE(id uuid, tutor_code text, display_name text, headline text, subjects text[], district text, hourly_rate integer, badge text, photo_url text, experience_years integer, languages text[], gender text, score numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c public.tutoring_cases%ROWTYPE;
  is_owner boolean;
  is_admin boolean;
BEGIN
  SELECT * INTO c FROM public.tutoring_cases WHERE tutoring_cases.id = _case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'case not found'; END IF;

  is_owner := (c.parent_id = auth.uid());
  is_admin := public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'staff');
  IF NOT (COALESCE(is_owner, false) OR COALESCE(is_admin, false)) THEN RAISE EXCEPTION 'forbidden'; END IF;

  RETURN QUERY
  SELECT
    t.id, t.tutor_code,
    CASE WHEN t.field_flags ? 'name' THEN NULL ELSE t.display_name END,
    CASE WHEN t.field_flags ? 'card_highlights' THEN NULL ELSE t.headline END,
    CASE WHEN t.field_flags ? 'subjects' THEN NULL ELSE t.subjects END,
    CASE WHEN t.field_flags ? 'location' THEN NULL ELSE t.district END,
    CASE WHEN t.field_flags ? 'pricing' THEN NULL ELSE t.hourly_rate END,
    t.badge,
    CASE WHEN t.field_flags ? 'photo' THEN NULL ELSE t.photo_url END,
    CASE WHEN t.field_flags ? 'experience_years' THEN NULL ELSE t.experience_years END,
    CASE WHEN t.field_flags ? 'languages' THEN NULL ELSE t.languages END,
    CASE WHEN t.field_flags ? 'gender' THEN NULL ELSE t.gender END,
    (
      (CASE WHEN EXISTS (
        SELECT 1 FROM unnest(c.subjects) cs
        WHERE EXISTS (SELECT 1 FROM unnest(t.subjects) ts WHERE lower(ts) = lower(cs))
      ) THEN 40 ELSE 0 END)
      + (CASE WHEN c.district IS NOT NULL AND c.district = ANY(t.stations) THEN 15 ELSE 0 END)
      + (CASE
           WHEN c.budget_max IS NULL OR c.budget_min IS NULL THEN 0
           WHEN t.hourly_rate BETWEEN c.budget_min AND c.budget_max THEN 15
           WHEN t.hourly_rate <= c.budget_max THEN 5
           ELSE 0 END)
      + (CASE
           WHEN c.mode = 'either' THEN 5
           WHEN t.lesson_mode::text = 'either' THEN 8
           WHEN c.mode::text = t.lesson_mode::text THEN 10
           ELSE 0 END)
      + (CASE
           WHEN c.preferred_gender = 'any' THEN 5
           WHEN t.gender IS NULL THEN 0
           WHEN c.preferred_gender::text = t.gender THEN 10
           ELSE 0 END)
      + (CASE
           WHEN c.tutor_background = 'any' THEN 5
           WHEN t.tutor_status IS NULL THEN 0
           WHEN c.tutor_background = 'uni_student' AND t.tutor_status = 'uni_student' THEN 15
           WHEN c.tutor_background = 'official_examiner' AND t.tutor_status = 'examiner' THEN 15
           ELSE 0 END)
      + (CASE
           WHEN c.language_of_instruction = 'either' THEN 5
           WHEN c.language_of_instruction = 'en' AND ('English' = ANY(t.languages) OR 'english' = ANY(t.languages)) THEN 10
           WHEN c.language_of_instruction = 'zh-HK' AND ('Cantonese' = ANY(t.languages) OR 'Chinese' = ANY(t.languages)) THEN 10
           ELSE 0 END)
      + (LEAST(COALESCE(t.experience_years,0), 10) * 1.0)
    )::numeric AS score
  FROM public.tutors t
  WHERE t.is_published = true
  ORDER BY score DESC, t.updated_at DESC
  LIMIT _limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.match_tutors_for_case(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.match_tutors_for_case(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_tutors_for_case(uuid, integer) TO authenticated;
