-- Issue #107: multi-degree support (undergraduate + postgraduate) so tutors
-- can showcase a Bachelor's plus a Master's / postgraduate / dual degree.
-- `university` held the (undergraduate) institution; it is renamed to
-- `undergrad_university` and joined by structured degree fields.
BEGIN;

ALTER TABLE tutors
  ADD COLUMN IF NOT EXISTS undergrad_university text,
  ADD COLUMN IF NOT EXISTS undergrad_degree text,
  ADD COLUMN IF NOT EXISTS undergrad_graduation_year text,
  ADD COLUMN IF NOT EXISTS has_postgrad boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS postgrad_university text,
  ADD COLUMN IF NOT EXISTS postgrad_degree text;

-- Carry the existing institution values into the renamed column before
-- dropping the old one.
UPDATE tutors
SET undergrad_university = university
WHERE undergrad_university IS NULL
  AND university IS NOT NULL;

ALTER TABLE tutors
  DROP COLUMN IF EXISTS university;

COMMENT ON COLUMN tutors.undergrad_university IS 'Undergraduate university or tertiary institution';
COMMENT ON COLUMN tutors.undergrad_degree IS 'Undergraduate degree or programme major';
COMMENT ON COLUMN tutors.undergrad_graduation_year IS 'Undergraduate graduation year (free text, optional)';
COMMENT ON COLUMN tutors.has_postgrad IS 'Whether the tutor holds or is pursuing a postgraduate / dual degree';
COMMENT ON COLUMN tutors.postgrad_university IS 'Postgraduate university, set when has_postgrad is true';
COMMENT ON COLUMN tutors.postgrad_degree IS 'Postgraduate degree or qualification, set when has_postgrad is true';

COMMIT;
