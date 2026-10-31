-- Issue #459 slice 2: child sub-profiles.
--
-- public.students (#530) was created minimal on purpose as the per-student
-- pack holder, with "#459 child sub-profiles will own the full profile".
-- This adds the parent-managed profile fields and links a case to the child
-- it is for, so one parent login with several children never mixes their
-- cases (and, in slice 3, their verified hours).
--
-- Access stays service-role only (RLS on, no anon/authenticated grants from
-- 20261030130000): parents read and write their children through server
-- functions scoped to their own user id.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS school text
    CHECK (school IS NULL OR char_length(school) <= 120),
  ADD COLUMN IF NOT EXISTS curriculum text
    CHECK (curriculum IS NULL OR char_length(curriculum) <= 40),
  ADD COLUMN IF NOT EXISTS grad_year integer
    CHECK (grad_year IS NULL OR grad_year BETWEEN 2000 AND 2100),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'managed_by_parent'
    CHECK (status IN ('managed_by_parent', 'linked_independent', 'claimed_independent')),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.students.status IS
  'Issue #459: managed_by_parent until the child claims their own account (claim flow is a later slice).';
COMMENT ON COLUMN public.students.archived_at IS
  'Issue #459: parents archive instead of delete; credit_accounts reference students ON DELETE RESTRICT.';

ALTER TABLE public.tutoring_cases
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.tutoring_cases.student_id IS
  'Issue #459: the child sub-profile this case is for (null for self/other or pre-#459 cases).';

CREATE INDEX IF NOT EXISTS idx_tutoring_cases_student
  ON public.tutoring_cases (student_id)
  WHERE student_id IS NOT NULL;
