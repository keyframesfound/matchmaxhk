-- Remap tutor education fields to their intended meanings.
-- Existing university values are academic headlines (for example, IBDP/DSE results).
-- Existing highschool values contain "Secondary School | University" in current data.

ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS academic_headline text,
  ADD COLUMN IF NOT EXISTS secondary_school text;

UPDATE public.tutors
SET academic_headline = university
WHERE academic_headline IS NULL
  AND university IS NOT NULL;

UPDATE public.tutors
SET
  university = CASE
    WHEN highschool IS NULL OR btrim(highschool) = '' THEN NULL
    WHEN strpos(highschool, '|') > 0 THEN NULLIF(btrim(split_part(highschool, '|', 2)), '')
    ELSE NULL
  END,
  secondary_school = CASE
    WHEN highschool IS NULL OR btrim(highschool) = '' THEN NULL
    WHEN strpos(highschool, '|') > 0 THEN NULLIF(btrim(split_part(highschool, '|', 1)), '')
    ELSE NULLIF(btrim(highschool), '')
  END
WHERE highschool IS NOT NULL;

ALTER TABLE public.tutors
  DROP COLUMN IF EXISTS highschool;


COMMENT ON COLUMN public.tutors.academic_headline IS 'Academic score or distinction shown as the tutor academic headline.';
COMMENT ON COLUMN public.tutors.university IS 'Tutor university or tertiary institution.';
COMMENT ON COLUMN public.tutors.secondary_school IS 'Tutor secondary school or high school.';

UPDATE public.tutors
SET updated_at = now();

