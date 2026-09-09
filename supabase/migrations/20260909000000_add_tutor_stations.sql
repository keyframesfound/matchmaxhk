-- Tutors can declare the MTR stations they teach at; parents filter by their nearest station.
ALTER TABLE public.tutors ADD COLUMN IF NOT EXISTS stations TEXT[] NOT NULL DEFAULT '{}';

-- Case requests now store a single MTR station in tutoring_cases.district,
-- so match scoring compares the case station against the tutor's station list.
-- Definition mirrors the live function (return shape differs from the original migration);
-- only the district scoring line changes to station membership.
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
