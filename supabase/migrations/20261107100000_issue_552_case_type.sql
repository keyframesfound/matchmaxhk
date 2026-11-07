-- #552: Private / Centre / Activity taxonomy for the case board. Legacy rows
-- default to private; rows already linked to a centre are backfilled.
ALTER TABLE public.tutoring_cases
  ADD COLUMN IF NOT EXISTS case_type text NOT NULL DEFAULT 'private';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tutoring_cases_case_type_check'
  ) THEN
    ALTER TABLE public.tutoring_cases
      ADD CONSTRAINT tutoring_cases_case_type_check
      CHECK (case_type IN ('private', 'centre', 'activity'));
  END IF;
END $$;

UPDATE public.tutoring_cases
SET case_type = 'centre'
WHERE organisation_id IS NOT NULL AND case_type <> 'centre';
