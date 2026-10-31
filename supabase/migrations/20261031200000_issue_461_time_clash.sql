-- Issue #461 addendum (2026-10-31) §1: time-clash guardrail.
--
-- Scheduling or moving a lesson into an already-booked block is blocked at
-- the database, for EITHER side:
--   * tutor  — any other active lesson (planned|confirmed) of the same tutor
--     overlaps in time (the old partial unique index only stopped exact
--     same-instant doubles; this trigger is the interval-overlap guard the
--     app's lessonConflicts() already models, incl. the 30-min face-to-face
--     travel buffer — applied only when BOTH lessons are non-online);
--   * learner — any other active lesson of the same student (via
--     tutoring_cases.student_id, the #459 child sub-profile; legacy cases
--     without a sub-profile are exempt from the learner half only).
--
-- Errors are named so server fns / the UI can map them:
--   TIME_CLASH_TUTOR / TIME_CLASH_LEARNER
-- (done/cancelled/late_cancel/no_show rows never clash; writes that keep a
-- lesson out of the active set pass through untouched).
--
-- mode is an enum on prod; every comparison casts ::text and defaults to
-- 'in_person' (the app's lessonConflicts default) — a bare 'f2f' literal
-- raises 22P02 invalid enum input (caught live 2026-10-31).

CREATE OR REPLACE FUNCTION public.guard_lesson_time_clash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_mode text;
  _student_id uuid;
  _clash uuid;
BEGIN
  IF NEW.status NOT IN ('planned', 'confirmed') THEN
    RETURN NEW;
  END IF;

  SELECT c.mode::text INTO _new_mode FROM public.tutoring_cases c WHERE c.id = NEW.case_id;

  -- Tutor half. 30-min travel buffer only when BOTH lessons are in-person.
  SELECT l.id INTO _clash
  FROM public.case_lessons l
  JOIN public.tutoring_cases c2 ON c2.id = l.case_id
  WHERE l.tutor_id = NEW.tutor_id
    AND l.id IS DISTINCT FROM NEW.id
    AND l.status IN ('planned', 'confirmed')
    AND l.starts_at < NEW.starts_at
        + GREATEST(NEW.duration_min, 1) * interval '1 minute'
        + (CASE WHEN COALESCE(_new_mode, 'in_person') <> 'online'
                 AND COALESCE(c2.mode::text, 'in_person') <> 'online'
           THEN interval '30 minutes' ELSE interval '0' END)
    AND NEW.starts_at < l.starts_at
        + GREATEST(l.duration_min, 1) * interval '1 minute'
        + (CASE WHEN COALESCE(_new_mode, 'in_person') <> 'online'
                 AND COALESCE(c2.mode::text, 'in_person') <> 'online'
           THEN interval '30 minutes' ELSE interval '0' END)
  LIMIT 1;
  IF _clash IS NOT NULL THEN
    RAISE EXCEPTION 'TIME_CLASH_TUTOR';
  END IF;

  -- Learner half (child sub-profile or independent student).
  SELECT c.student_id INTO _student_id
  FROM public.tutoring_cases c
  WHERE c.id = NEW.case_id;
  IF _student_id IS NOT NULL THEN
    SELECT l.id INTO _clash
    FROM public.case_lessons l
    JOIN public.tutoring_cases c2 ON c2.id = l.case_id
    WHERE c2.student_id = _student_id
      AND l.id IS DISTINCT FROM NEW.id
      AND l.status IN ('planned', 'confirmed')
      AND l.starts_at < NEW.starts_at
          + GREATEST(NEW.duration_min, 1) * interval '1 minute'
          + (CASE WHEN COALESCE(_new_mode, 'in_person') <> 'online'
                   AND COALESCE(c2.mode::text, 'in_person') <> 'online'
             THEN interval '30 minutes' ELSE interval '0' END)
      AND NEW.starts_at < l.starts_at
          + GREATEST(l.duration_min, 1) * interval '1 minute'
          + (CASE WHEN COALESCE(_new_mode, 'in_person') <> 'online'
                   AND COALESCE(c2.mode::text, 'in_person') <> 'online'
             THEN interval '30 minutes' ELSE interval '0' END)
    LIMIT 1;
    IF _clash IS NOT NULL THEN
      RAISE EXCEPTION 'TIME_CLASH_LEARNER';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_case_lessons_time_clash ON public.case_lessons;
CREATE TRIGGER trg_case_lessons_time_clash
  BEFORE INSERT OR UPDATE OF case_id, tutor_id, starts_at, duration_min, status
  ON public.case_lessons
  FOR EACH ROW EXECUTE FUNCTION public.guard_lesson_time_clash();

COMMENT ON FUNCTION public.guard_lesson_time_clash() IS
  'Issue #461 addendum §1: blocks scheduling a lesson that overlaps an active lesson of the same tutor or learner. Raises TIME_CLASH_TUTOR / TIME_CLASH_LEARNER.';
