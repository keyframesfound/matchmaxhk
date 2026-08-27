BEGIN;

-- Preserve the only long-form tutor content for profiles that do not yet have
-- a qualifications summary before retiring the legacy biography column.
UPDATE public.tutors
SET qualifications_summary = NULLIF(BTRIM(bio), '')
WHERE NULLIF(BTRIM(qualifications_summary), '') IS NULL
  AND NULLIF(BTRIM(bio), '') IS NOT NULL;

-- Retire fields that are no longer part of the tutor card, tutor profile,
-- discovery workflow, or active admin form.
ALTER TABLE public.tutors
  DROP COLUMN IF EXISTS academic_summary,
  DROP COLUMN IF EXISTS education,
  DROP COLUMN IF EXISTS teaching_since,
  DROP COLUMN IF EXISTS bio;

COMMIT;
