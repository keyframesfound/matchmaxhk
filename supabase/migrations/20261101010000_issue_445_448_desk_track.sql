-- Issues #445 + #448: internal tutor desk track (Master Sheet Tutors W–Y,
-- in-app). A staff-only table keeps the CS desk track out of the tutors row
-- entirely, so no public/parent/tutor surface can ever select it (#448:
-- "zero level chrome on public"; the public schema stays unchanged).
--
--   * tutor_level  — manual New | Active | Experienced (default New),
--                    upgraded per CS-005: 1 paid fee-collected case or 5+
--                    verified Pro-Bono hours. Experienced stays manual in V1.
--   * guide_sent   — stamp + actor for the Tutor Service Guide share
--                    (/tfirst first-match step).
--   * l1_early_dropoffs — early L1 drop-off count; at ≥2 the desk surface
--                    links the #441 REVIEW flag path.
--
-- Posture: RLS on, ZERO grants to anon/authenticated, no policies — the
-- #441 risk_flags posture. Every read/write goes through the staff-gated
-- server fns in features/admin/desk-track.functions.ts. match_tutors_for_case
-- is SECURITY DEFINER, so it reads the desk terms for soft sort only and
-- never returns them (the RPC is also callable by the case owner).

CREATE TABLE IF NOT EXISTS public.tutor_desk_track (
  tutor_id uuid PRIMARY KEY REFERENCES public.tutors(id) ON DELETE CASCADE,
  tutor_level text NOT NULL DEFAULT 'new'
    CHECK (tutor_level IN ('new', 'active', 'experienced')),
  guide_sent_at timestamptz,
  guide_sent_by uuid,
  l1_early_dropoffs integer NOT NULL DEFAULT 0 CHECK (l1_early_dropoffs >= 0),
  dropoff_note text CHECK (dropoff_note IS NULL OR char_length(dropoff_note) <= 500),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.tutor_desk_track ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tutor_desk_track FROM anon, authenticated;

COMMENT ON TABLE public.tutor_desk_track IS
  'Issues #445/#448: manual internal tutor desk track (level, Guide-sent, L1 early drop-offs). Service-role only via admin-gated server fns — never public, never on parent/tutor surfaces, soft-prefer only in match_tutors_for_case (staff override always).';

-- ---------------------------------------------------------------------------
-- #448: desk-track soft sort inside the internal shortlist RPC. Output
-- columns stay EXACTLY as before — desk data informs the score only.
--
-- CS-005 soft rules:
--   * Easy desks prefer New: short-case (#443), Pro-Bono, Kindergarten /
--     Primary / Junior secondary → +20 for tutor_level = new.
--   * Finals desks soft-deprioritise New: S6/Y12–Y13 (DSE final), IBDP Y2
--     → −20 for tutor_level = new (tolerant grade match, spaces stripped).
--   * Active/Experienced are unaffected; agents override freely (soft
--     score, not a filter).
-- ---------------------------------------------------------------------------
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
      -- #448 desk-track soft prefer (see header; staff override always).
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
  ORDER BY
    -- #449 Soft Inactive: accepting tutors first, inactive bottom, both listed.
    (CASE WHEN COALESCE(t.is_accepting_students, true) THEN 0 ELSE 1 END),
    score DESC,
    t.updated_at DESC
  LIMIT _limit;
END;
$function$;
