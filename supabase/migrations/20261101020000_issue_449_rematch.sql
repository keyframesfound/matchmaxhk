-- Issue #449 — Failed-Trial Pivot backend: the rematch case that the desk's
-- pivot action creates. (Status/labels/board rules landed in
-- 20261025230010; this adds the two DB pieces the handler needs.)
--
--   1. One rematch per failed case: a partial unique index on
--      replacement_of_case_id makes a double-clicked Pivot idempotent at
--      the storage layer ("one new case per failed case id"). The handler
--      pre-checks and treats 23505 as "already done", so retries and races
--      converge on the same rematch case instead of spawning duplicates.
--
--   2. Shortlist exclusion: match_tutors_for_case now drops the tutor who
--      just failed the replaced case, so "shortlist next ≤2 from ORIGINAL
--      criteria (exclude failed tutor id)" holds without a new parameter.
--      Output columns unchanged.
--
-- Applied to prod via MCP; this file mirrors it for the repo.

CREATE UNIQUE INDEX IF NOT EXISTS tutoring_cases_one_rematch_per_failed
  ON public.tutoring_cases (replacement_of_case_id)
  WHERE replacement_of_case_id IS NOT NULL;

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
           WHEN COALESCE(c.budget_max_hkd, c.budget_max) IS NULL OR COALESCE(c.budget_min_hkd, c.budget_min) IS NULL THEN 0
           WHEN COALESCE(t.min_hourly_rate_hkd, t.hourly_rate) BETWEEN COALESCE(c.budget_min_hkd, c.budget_min) AND COALESCE(c.budget_max_hkd, c.budget_max) THEN 15
           WHEN COALESCE(t.min_hourly_rate_hkd, t.hourly_rate) <= COALESCE(c.budget_max_hkd, c.budget_max) THEN 5
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
      -- #451 soft prefer: a paid admin fee on any past case.
      + (CASE WHEN EXISTS (
           SELECT 1 FROM public.case_fees f
           JOIN public.tutoring_cases tc ON tc.id = f.case_id
           WHERE tc.matched_tutor_id = t.id AND f.status = 'paid'
         ) THEN 25 ELSE 0 END)
      -- #448 desk-track soft prefer: easy desks prefer New, finals desks
      -- soft-deprioritise New (staff override always; score-only, no output).
      + (CASE
           WHEN COALESCE(dt.tutor_level, 'new') <> 'new' THEN 0
           WHEN c.is_short_case
             OR c.package_type = 'pro_bono'
             OR COALESCE(c.student_level, '') IN ('Kindergarten', 'Primary', 'Junior secondary')
           THEN 20
           WHEN lower(regexp_replace(COALESCE(c.student_grade_current, ''), '\s', '', 'g'))
                IN ('s6', 'y12', 'y13', 'year12', 'year13', 'form6', 'form7', 'ib2', 'ibdpy2')
           THEN -20
           ELSE 0
         END)
    )::numeric AS score
  FROM public.tutors t
  LEFT JOIN public.tutor_desk_track dt ON dt.tutor_id = t.id
  WHERE t.is_published = true
    -- #449: a rematch case never re-suggests the tutor who just failed the
    -- replaced case (next ≤2 from the ORIGINAL criteria, failed tutor out).
    AND t.id IS DISTINCT FROM (
      SELECT pc.matched_tutor_id FROM public.tutoring_cases pc
      WHERE pc.id = c.replacement_of_case_id
    )
  ORDER BY
    (CASE WHEN COALESCE(t.is_accepting_students, true) THEN 0 ELSE 1 END),
    score DESC,
    t.updated_at DESC
  LIMIT _limit;
END;
$function$;
