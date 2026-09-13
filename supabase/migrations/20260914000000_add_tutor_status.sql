-- Tutor status: university student, full/part-time tutor, or examiner /
-- professional teacher. Sourced from tutor applications and set per tutor by
-- admins (TutorEditor); NULL means not yet classified.
ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS tutor_status TEXT
  CHECK (tutor_status IN ('uni_student', 'full_part_time_tutor', 'examiner'));

-- Case matching now honors tutoring_cases.tutor_background by scoring it
-- against tutors.tutor_status (soft preference, no hard filter).
-- Definition mirrors the previous migration; only the background line is new.
DROP FUNCTION IF EXISTS public.match_tutors_for_case(uuid, integer);

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
    t.id, t.tutor_code, t.display_name, t.headline,
    t.subjects, t.district, t.hourly_rate, t.badge,
    t.photo_url, t.experience_years, t.languages, t.gender,
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
