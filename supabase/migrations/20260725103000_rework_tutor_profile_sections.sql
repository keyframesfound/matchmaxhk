ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS university text,
  ADD COLUMN IF NOT EXISTS highschool text,
  ADD COLUMN IF NOT EXISTS target_students text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS academic_summary text,
  ADD COLUMN IF NOT EXISTS qualifications_summary text;

-- Backfill school fields from existing education rows where level signals the institution type.
WITH edu AS (
  SELECT
    t.id,
    (
      SELECT e->>'institution'
      FROM jsonb_array_elements(COALESCE(t.education, '[]'::jsonb)) AS e
      WHERE COALESCE(e->>'institution', '') <> ''
        AND lower(COALESCE(e->>'level', '')) IN ('undergraduate', 'postgraduate', 'doctorate')
      LIMIT 1
    ) AS inferred_university,
    (
      SELECT e->>'institution'
      FROM jsonb_array_elements(COALESCE(t.education, '[]'::jsonb)) AS e
      WHERE COALESCE(e->>'institution', '') <> ''
        AND lower(COALESCE(e->>'level', '')) = 'secondary school'
      LIMIT 1
    ) AS inferred_highschool
  FROM public.tutors t
)
UPDATE public.tutors t
SET
  university = COALESCE(NULLIF(t.university, ''), NULLIF(edu.inferred_university, '')),
  highschool = COALESCE(NULLIF(t.highschool, ''), NULLIF(edu.inferred_highschool, ''))
FROM edu
WHERE t.id = edu.id;

UPDATE public.tutors
SET target_students = '{}'::text[]
WHERE target_students IS NULL;
