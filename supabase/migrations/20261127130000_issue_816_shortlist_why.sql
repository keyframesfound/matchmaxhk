-- ---------------------------------------------------------------------------
-- Issue #816 §2.7 / AC-428-3 — explainable staff shortlist + pin/override
-- ---------------------------------------------------------------------------
-- match_tutors_for_case already computes every score term inline but returns
-- only the opaque total. This migration keeps the scoring maths exactly as it
-- is (same owner-or-staff gate, same #449 failed-tutor exclusion, same #448
-- desk-track soft terms) and lifts each term into a named output column so the
-- desk can say WHY a tutor ranks where they do.
--
--   * why  — stable, machine-readable tokens in this order:
--            subject, district, rate_full, rate_partial, mode, gender,
--            background, language, experience, paid_fee, easy_desk.
--            The UI owns the English labels; SQL emits tokens, never prose.
--   * factor_* — the individual terms, so the badge and the chips can never
--                disagree with the total (score is their sum).
--
-- One incidental correction: the desk-track term now uses the regex '\s'
-- (whitespace) where the previous body had a literal '\\s'. The old literal
-- could never match a normal grade string, so the finals-desk -20 term was
-- effectively dead for grades written with a space.
--
-- The return type grows, so the function is dropped and recreated; grants are
-- re-emitted afterwards. _limit default moves to 8 to match the desk Top-8
-- shortlist (callers still pass it explicitly).
--
-- The pin column is staff state: tutoring_cases keeps COLUMN-LEVEL SELECT for
-- authenticated (20261017170000 BE2), so the new column needs the same
-- additive GRANT SELECT (col) as priority_tier (#438). Writes go through the
-- desk-gated (staff/admin/super_admin) service-role server fns in
-- features/cases/shortlist.functions.ts.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.match_tutors_for_case(uuid, integer);

CREATE FUNCTION public.match_tutors_for_case(_case_id uuid, _limit integer DEFAULT 8)
 RETURNS TABLE(
   id uuid,
   tutor_code text,
   display_name text,
   headline text,
   subjects text[],
   district text,
   hourly_rate integer,
   badge text,
   photo_url text,
   experience_years integer,
   languages text[],
   gender text,
   score numeric,
   why text[],
   factor_subject int,
   factor_district int,
   factor_rate int,
   factor_mode int,
   factor_gender int,
   factor_background int,
   factor_language int,
   factor_experience numeric,
   factor_paid_fee int,
   factor_desk_track int
 )
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
  WITH factor_rows AS (
    SELECT
      t.id, t.tutor_code, t.display_name, t.headline,
      t.subjects, t.district, t.hourly_rate, t.badge,
      t.photo_url, t.experience_years, t.languages, t.gender,
      t.updated_at,
      (CASE WHEN COALESCE(t.is_accepting_students, true) THEN 0 ELSE 1 END) AS accepting_sort,
      (CASE WHEN EXISTS (
        SELECT 1 FROM unnest(c.subjects) cs
        WHERE EXISTS (SELECT 1 FROM unnest(t.subjects) ts WHERE lower(ts) = lower(cs))
      ) THEN 40 ELSE 0 END)::int AS factor_subject,
      (CASE WHEN c.district IS NOT NULL AND c.district = ANY(t.stations) THEN 15 ELSE 0 END)::int AS factor_district,
      (CASE
         WHEN COALESCE(c.budget_max_hkd, c.budget_max) IS NULL OR COALESCE(c.budget_min_hkd, c.budget_min) IS NULL THEN 0
         WHEN COALESCE(t.min_hourly_rate_hkd, t.hourly_rate) BETWEEN COALESCE(c.budget_min_hkd, c.budget_min) AND COALESCE(c.budget_max_hkd, c.budget_max) THEN 15
         WHEN COALESCE(t.min_hourly_rate_hkd, t.hourly_rate) <= COALESCE(c.budget_max_hkd, c.budget_max) THEN 5
         ELSE 0
       END)::int AS factor_rate,
      (CASE
         WHEN c.mode = 'either' THEN 5
         WHEN t.lesson_mode::text = 'either' THEN 8
         WHEN c.mode::text = t.lesson_mode::text THEN 10
         ELSE 0
       END)::int AS factor_mode,
      (CASE
         WHEN c.preferred_gender = 'any' THEN 5
         WHEN t.gender IS NULL THEN 0
         WHEN c.preferred_gender::text = t.gender THEN 10
         ELSE 0
       END)::int AS factor_gender,
      (CASE
         WHEN c.tutor_background = 'any' THEN 5
         WHEN t.tutor_status IS NULL THEN 0
         WHEN c.tutor_background = 'uni_student' AND t.tutor_status IN ('uni_student','uni_undergrad') THEN 15
         WHEN c.tutor_background = 'official_examiner' AND t.tutor_status = 'examiner' THEN 15
         ELSE 0
       END)::int AS factor_background,
      (CASE
         WHEN c.language_of_instruction = 'either' THEN 5
         WHEN c.language_of_instruction = 'en' AND ('English' = ANY(t.languages) OR 'english' = ANY(t.languages)) THEN 10
         WHEN c.language_of_instruction = 'zh-HK' AND ('Cantonese' = ANY(t.languages) OR 'Chinese' = ANY(t.languages)) THEN 10
         ELSE 0
       END)::int AS factor_language,
      (LEAST(COALESCE(t.experience_years,0), 10) * 1.0)::numeric AS factor_experience,
      -- #451 soft prefer: a paid admin fee on any past case.
      (CASE WHEN EXISTS (
         SELECT 1 FROM public.case_fees f
         JOIN public.tutoring_cases tc ON tc.id = f.case_id
         WHERE tc.matched_tutor_id = t.id AND f.status = 'paid'
       ) THEN 25 ELSE 0 END)::int AS factor_paid_fee,
      -- #448 desk-track soft prefer: easy desks prefer New, finals desks
      -- soft-deprioritise New (staff override always; score-only, no filter).
      (CASE
         WHEN COALESCE(dt.tutor_level, 'new') <> 'new' THEN 0
         WHEN c.is_short_case
           OR c.package_type = 'pro_bono'
           OR COALESCE(c.student_level, '') IN ('Kindergarten', 'Primary', 'Junior secondary')
         THEN 20
         WHEN lower(regexp_replace(COALESCE(c.student_grade_current, ''), '\s', '', 'g'))
              IN ('s6', 'y12', 'y13', 'year12', 'year13', 'form6', 'form7', 'ib2', 'ibdpy2')
         THEN -20
         ELSE 0
       END)::int AS factor_desk_track
    FROM public.tutors t
    LEFT JOIN public.tutor_desk_track dt ON dt.tutor_id = t.id
    WHERE t.is_published = true
      -- #449: a rematch case never re-suggests the tutor who just failed the
      -- replaced case (next ≤2 from the ORIGINAL criteria, failed tutor out).
      AND t.id IS DISTINCT FROM (
        SELECT pc.matched_tutor_id FROM public.tutoring_cases pc
        WHERE pc.id = c.replacement_of_case_id
      )
  ),
  scored AS (
    SELECT
      f.*,
      (
        f.factor_subject
        + f.factor_district
        + f.factor_rate
        + f.factor_mode
        + f.factor_gender
        + f.factor_background
        + f.factor_language
        + f.factor_experience
        + f.factor_paid_fee
        + f.factor_desk_track
      )::numeric AS score,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN f.factor_subject = 40 THEN 'subject' END,
        CASE WHEN f.factor_district = 15 THEN 'district' END,
        CASE WHEN f.factor_rate = 15 THEN 'rate_full' END,
        CASE WHEN f.factor_rate = 5 THEN 'rate_partial' END,
        CASE WHEN f.factor_mode > 0 THEN 'mode' END,
        CASE WHEN f.factor_gender = 10 THEN 'gender' END,
        CASE WHEN f.factor_background = 15 THEN 'background' END,
        CASE WHEN f.factor_language = 10 THEN 'language' END,
        CASE WHEN f.factor_experience >= 5 THEN 'experience' END,
        CASE WHEN f.factor_paid_fee = 25 THEN 'paid_fee' END,
        CASE WHEN f.factor_desk_track = 20 THEN 'easy_desk' END
      ], NULL)::text[] AS why
    FROM factor_rows f
  )
  SELECT
    s.id, s.tutor_code, s.display_name, s.headline,
    s.subjects, s.district, s.hourly_rate, s.badge,
    s.photo_url, s.experience_years, s.languages, s.gender,
    s.score,
    s.why,
    s.factor_subject,
    s.factor_district,
    s.factor_rate,
    s.factor_mode,
    s.factor_gender,
    s.factor_background,
    s.factor_language,
    s.factor_experience,
    s.factor_paid_fee,
    s.factor_desk_track
  FROM scored s
  ORDER BY
    s.accepting_sort,
    s.score DESC,
    s.updated_at DESC
  LIMIT _limit;
END;
$function$;

COMMENT ON FUNCTION public.match_tutors_for_case(uuid, integer) IS
  '#816 §2.7: explainable shortlist. Returns the same score plus its named factors '
  'and a stable token list (why) so the staff desk can show Why chips. Tokens: '
  'subject, district, rate_full, rate_partial, mode, gender, background, language, '
  'experience, paid_fee, easy_desk. Authorization and the #449 failed-tutor '
  'exclusion are unchanged.';

REVOKE ALL ON FUNCTION public.match_tutors_for_case(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.match_tutors_for_case(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_tutors_for_case(uuid, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- Staff pin/override on the shortlist. Nullable: no pin by default, and a
-- deleted tutor clears the pin (ON DELETE SET NULL) instead of blocking.
-- ---------------------------------------------------------------------------
ALTER TABLE public.tutoring_cases
  ADD COLUMN IF NOT EXISTS shortlist_pinned_tutor_id uuid
    REFERENCES public.tutors(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.tutoring_cases.shortlist_pinned_tutor_id IS
  '#816 §2.7: staff-pinned tutor on the case shortlist. Written by the '
  'desk-gated service-role server fns in features/cases/shortlist.functions.ts '
  '(setShortlistPin), which also appends the recommendation_used funnel event '
  'and the case_audit row.';

-- Additive column grant: MERGES with the existing column-level SELECT list.
GRANT SELECT (shortlist_pinned_tutor_id) ON public.tutoring_cases TO authenticated;
