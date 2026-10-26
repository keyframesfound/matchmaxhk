-- Application status panel lookup fix (#480 follow-up).
--
-- getMyApplicationStatus resolved the applicant's identity by scanning the
-- 500 NEWEST tutor_applications rows and filtering by email in Node. Two
-- problems: (a) once >500 newer applications exist, an applicant's row
-- falls outside the window and the panel silently vanishes (the /account
-- page then shows the "become a tutor" CTA, inviting a duplicate resubmit);
-- (b) the referenced index can never serve the read anyway, because
-- filtering happened client-side.
--
-- Fix: a STORED generated column with the submit email normalized the same
-- way the resolver compares (lower + btrim), indexed, so the server fn can
-- filter in SQL. Rows with no email in data stay NULL and are excluded by
-- the partial index.

ALTER TABLE public.tutor_applications
  ADD COLUMN IF NOT EXISTS email_lower text
  GENERATED ALWAYS AS (lower(btrim(data ->> 'email'))) STORED;

CREATE INDEX IF NOT EXISTS idx_tutor_applications_email_lower
  ON public.tutor_applications (email_lower)
  WHERE email_lower IS NOT NULL;
