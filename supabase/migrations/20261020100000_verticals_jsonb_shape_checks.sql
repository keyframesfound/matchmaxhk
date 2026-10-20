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
--     normalizer-only, NOT re-enforced here).
--   tutors.course_specific_grades
--     jsonb object map: course tag (same text rules as above, keys <= 40
--     chars) -> canonical grade string. Grade vocab mirrors
--     COURSE_GRADE_OPTIONS in verticals.ts.
--   tutoring_cases.kindergarten_focus
--     jsonb array of the 9 canonical kindergarten topic tags
--     (KINDERGARTEN_TOPICS in verticals.ts).
-- Column defaults ('[]', '{}', '[]') satisfy every constraint below.

ALTER TABLE public.tutors
  DROP CONSTRAINT IF EXISTS tutors_university_courses_shape_chk;
ALTER TABLE public.tutors
  ADD CONSTRAINT tutors_university_courses_shape_chk CHECK (
    jsonb_typeof(university_courses) = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(university_courses) AS course(tag)
      WHERE jsonb_typeof(course.tag) <> 'string'
        OR btrim(course.tag #>> '{}') = ''
        OR length(course.tag #>> '{}') > 40
    )
  );

ALTER TABLE public.tutors
  DROP CONSTRAINT IF EXISTS tutors_course_specific_grades_shape_chk;
ALTER TABLE public.tutors
  ADD CONSTRAINT tutors_course_specific_grades_shape_chk CHECK (
    jsonb_typeof(course_specific_grades) = 'object'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_each_text(course_specific_grades) AS grade(course_tag, grade_value)
      WHERE btrim(grade.course_tag) = ''
        OR length(grade.course_tag) > 40
        OR grade.grade_value NOT IN (
          'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'Pass'
        )
    )
  );

ALTER TABLE public.tutoring_cases
  DROP CONSTRAINT IF EXISTS tutoring_cases_kindergarten_focus_shape_chk;
ALTER TABLE public.tutoring_cases
  ADD CONSTRAINT tutoring_cases_kindergarten_focus_shape_chk CHECK (
    jsonb_typeof(kindergarten_focus) = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(kindergarten_focus) AS topic(tag)
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
    )
  );
