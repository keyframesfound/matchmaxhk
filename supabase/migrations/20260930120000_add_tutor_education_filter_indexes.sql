-- Issue #130: university & secondary school filters for the parent directory.
-- Filter options are derived client-side from the existing free-text
-- undergrad_university / postgrad_university / secondary_school columns, so no
-- schema change is required; these indexes only make the derived lists fast.

CREATE INDEX IF NOT EXISTS tutors_undergrad_university_idx
  ON public.tutors (undergrad_university);

CREATE INDEX IF NOT EXISTS tutors_postgrad_university_idx
  ON public.tutors (postgrad_university);

CREATE INDEX IF NOT EXISTS tutors_secondary_school_idx
  ON public.tutors (secondary_school);
