-- #528 L1 retention: low-friction fit data (Phase A) + backend-only signals.
--
-- Rules live in src/features/cases/fit-tags.ts (fitHint, fitReasonError).
-- Posture:
--   * tutors soft tags are PUBLIC profile facts the tutor sets (owner RLS,
--     same as the #520 promo toggles). All optional, < 15s to fill.
--   * tutoring_cases pref_* + drop_fit_reason are staff-only: no column grant
--     to authenticated (column-level grants since 20261026000000).
--   * case_fit_signals is a staff-only view (service role).

DO $$
BEGIN
  ALTER TABLE public.tutors
    ADD COLUMN IF NOT EXISTS teaching_style text
      CHECK (teaching_style IS NULL OR teaching_style IN ('EXAM_DRILLING', 'CONCEPT_PATIENCE', 'HOMEWORK_COACHING')),
    ADD COLUMN IF NOT EXISTS materials_policy text
      CHECK (materials_policy IS NULL OR materials_policy IN ('PROVIDES_OWN_NOTES', 'USES_SCHOOL_MATERIALS')),
    ADD COLUMN IF NOT EXISTS vibe_preference text
      CHECK (vibe_preference IS NULL OR vibe_preference IN ('STRICT_DISCIPLINED', 'WARM_ENCOURAGING')),
    ADD COLUMN IF NOT EXISTS homework_expectation text
      CHECK (homework_expectation IS NULL OR homework_expectation IN ('WEEKLY_EXTRA_HOMEWORK', 'IN_CLASS_ONLY'));

  ALTER TABLE public.tutoring_cases
    ADD COLUMN IF NOT EXISTS pref_teaching_style text
      CHECK (pref_teaching_style IS NULL OR pref_teaching_style IN ('EXAM_DRILLING', 'CONCEPT_PATIENCE', 'HOMEWORK_COACHING')),
    ADD COLUMN IF NOT EXISTS pref_materials_policy text
      CHECK (pref_materials_policy IS NULL OR pref_materials_policy IN ('PROVIDES_OWN_NOTES', 'USES_SCHOOL_MATERIALS')),
    ADD COLUMN IF NOT EXISTS pref_vibe text
      CHECK (pref_vibe IS NULL OR pref_vibe IN ('STRICT_DISCIPLINED', 'WARM_ENCOURAGING')),
    ADD COLUMN IF NOT EXISTS pref_homework text
      CHECK (pref_homework IS NULL OR pref_homework IN ('WEEKLY_EXTRA_HOMEWORK', 'IN_CLASS_ONLY')),
    -- The one required drop reason tag on verify (#528 §3.2). Feeds #514 CRM.
    ADD COLUMN IF NOT EXISTS drop_fit_reason text
      CHECK (drop_fit_reason IS NULL OR drop_fit_reason IN (
        'STYLE_TOO_LENIENT', 'STYLE_TOO_STRICT', 'NO_CUSTOM_MATERIALS', 'PACE_MISMATCH',
        'COMMUNICATION_GAP', 'TUTOR_UNPREPARED', 'SCHEDULE_CHANGE', 'TUTOR_QUIT', 'OTHER'));

  -- L1 reschedule count (backend-only signal, no UI survey).
  ALTER TABLE public.case_lessons
    ADD COLUMN IF NOT EXISTS reschedule_count integer NOT NULL DEFAULT 0
      CHECK (reschedule_count >= 0);
END;
$$;

COMMENT ON COLUMN public.tutoring_cases.drop_fit_reason IS
  '#528: required fit tag when a stop after L1 is verified. Staff-only.';

CREATE OR REPLACE FUNCTION public.case_lessons_count_reschedule()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.starts_at IS DISTINCT FROM OLD.starts_at THEN
    NEW.reschedule_count := OLD.reschedule_count + 1;
  ELSE
    NEW.reschedule_count := OLD.reschedule_count;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_case_lessons_count_reschedule ON public.case_lessons;
CREATE TRIGGER trg_case_lessons_count_reschedule
  BEFORE UPDATE ON public.case_lessons
  FOR EACH ROW EXECUTE FUNCTION public.case_lessons_count_reschedule();

-- First-contact latency proxy: match -> first lesson booked (no tutor
-- contact event exists yet). Plus L1 reschedules.
CREATE OR REPLACE VIEW public.case_fit_signals
WITH (security_invoker = true) AS
SELECT
  c.id AS case_id,
  c.matched_at,
  fl.first_lesson_booked_at,
  CASE WHEN c.matched_at IS NOT NULL AND fl.first_lesson_booked_at IS NOT NULL
    THEN round(extract(epoch FROM fl.first_lesson_booked_at - c.matched_at) / 60)::integer
  END AS match_to_l1_booked_minutes,
  COALESCE(l1.reschedule_count, 0) AS l1_reschedule_count,
  c.drop_fit_reason
FROM public.tutoring_cases c
LEFT JOIN LATERAL (
  SELECT min(created_at) AS first_lesson_booked_at
  FROM public.case_lessons WHERE case_id = c.id
) fl ON true
LEFT JOIN public.case_lessons l1 ON l1.case_id = c.id AND l1.sequence = 1;

REVOKE ALL ON public.case_fit_signals FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.case_fit_signals FROM anon, authenticated;
    GRANT SELECT ON public.case_fit_signals TO service_role;
  END IF;
END;
$$;
