-- Issue #389: DB shape CHECKs for the verticals jsonb columns added in
-- 20261019120000_verticals. The app normalizers
-- (src/features/tutors/verticals.ts, src/features/cases/case-verticals.ts)
-- gate honest clients; these constraints make the database reject
-- non-canonical shapes from any other writer (owner JWT via PostgREST,
-- service-role scripts, crafted RPC payloads).
--
-- Canonical shapes — exactly what the normalizers can produce:
--   tutors.university_courses
--     jsonb array of non-empty text tags, each <= 40 chars after trim
--     (normalizeUniversityCourses: trim -> slice(0,40) -> drop blanks ->
--     case-insensitive dedupe -> cap 12; the cap and dedupe stay
--     normalizer-only, NOT re-enforced here). Untrimmed-but-nonblank
--     tags (' CS') are rejected explicitly: no normalizer emits them.
--   tutors.course_specific_grades
--     jsonb object map: course tag (same text rules as above, keys <= 40
--     chars) -> canonical grade string. Grade vocab mirrors
--     COURSE_GRADE_OPTIONS in verticals.ts. JSON-null values and
--     untrimmed-but-nonblank keys are rejected explicitly: jsonb_each_text
--     renders a JSON null as SQL NULL, which silently dodges a bare
--     NOT IN (...) — hence the IS NULL guard.
--   tutoring_cases.kindergarten_focus
--     jsonb array of the 9 canonical kindergarten topic tags
--     (KINDERGARTEN_TOPICS in verticals.ts).
-- Column defaults ('[]', '{}', '[]') satisfy every constraint below.
--
-- Postgres CHECK constraints cannot contain subqueries (0A000), so each
-- NOT EXISTS predicate lives in an IMMUTABLE validator function and the
-- constraint calls it. The predicates are identical to the probe queries
-- run against live data before apply (0 violating rows).

CREATE OR REPLACE FUNCTION public.university_courses_shape_ok(p_courses jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT jsonb_typeof(p_courses) = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_courses) AS course(tag)
      WHERE jsonb_typeof(course.tag) <> 'string'
        OR btrim(course.tag #>> '{}') = ''
        OR btrim(course.tag #>> '{}') <> (course.tag #>> '{}')
        OR length(course.tag #>> '{}') > 40
    );
$fn$;

CREATE OR REPLACE FUNCTION public.course_specific_grades_shape_ok(p_grades jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT jsonb_typeof(p_grades) = 'object'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_each_text(p_grades) AS grade(course_tag, grade_value)
      WHERE btrim(grade.course_tag) = ''
        OR length(grade.course_tag) > 40
        OR grade.course_tag <> btrim(grade.course_tag)
        OR grade.grade_value IS NULL
        OR grade.grade_value NOT IN (
          'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'Pass'
        )
    );
$fn$;

CREATE OR REPLACE FUNCTION public.kindergarten_focus_shape_ok(p_focus jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT jsonb_typeof(p_focus) = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_focus) AS topic(tag)
      WHERE jsonb_typeof(topic.tag) <> 'string'
        OR (topic.tag #>> '{}') <> ALL (ARRAY[
          'Kindergarten Phonics',
          'Kindergarten English Reading',
          'Kindergarten English Writing',
          'Kindergarten Mandarin Immersion',
          'Kindergarten Basic Mathematics',
          'P1 Interview — Communication & Etiquette',
          'P1 Interview — Group Play Observation',
          'P1 Interview — Storytelling & Role-play',
          'P1 Interview — General Knowledge'
        ])
    );
$fn$;

ALTER TABLE public.tutors
  DROP CONSTRAINT IF EXISTS tutors_university_courses_shape_chk;
ALTER TABLE public.tutors
  ADD CONSTRAINT tutors_university_courses_shape_chk
  CHECK (public.university_courses_shape_ok(university_courses));

ALTER TABLE public.tutors
  DROP CONSTRAINT IF EXISTS tutors_course_specific_grades_shape_chk;
ALTER TABLE public.tutors
  ADD CONSTRAINT tutors_course_specific_grades_shape_chk
  CHECK (public.course_specific_grades_shape_ok(course_specific_grades));

ALTER TABLE public.tutoring_cases
  DROP CONSTRAINT IF EXISTS tutoring_cases_kindergarten_focus_shape_chk;
ALTER TABLE public.tutoring_cases
  ADD CONSTRAINT tutoring_cases_kindergarten_focus_shape_chk
  CHECK (public.kindergarten_focus_shape_ok(kindergarten_focus));
