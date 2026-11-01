-- Issue #545: Lifelong Academic Records & Education CV (lightweight V1).
--
-- Two service-role tables (RLS on, no client grants — students/ledger
-- posture): every read/write goes through
-- src/features/account/academic-records.functions.ts.
--
--   learner_snapshots — per-learner diagnostic summary (Current Level,
--                       Strengths, Needs Help With, Target Goals) plus the
--                       "share with matched tutors" toggle.
--   academic_records  — timeline cards in 6 locked categories with
--                       per-record visibility.
--
-- Ownership model mirrors #459: a record belongs to the account
-- (owner_user_id) for the "Myself" learner, or to a child sub-profile
-- (child_profile_id, students.id) while parent-managed. The #547 claim
-- flow flips child rows to self-owned on claim (owner_user_id = child's
-- new account, child_profile_id = NULL).

CREATE TABLE IF NOT EXISTS public.learner_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_profile_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  current_level text CHECK (current_level IS NULL OR char_length(current_level) <= 60),
  strengths_text text CHECK (strengths_text IS NULL OR char_length(strengths_text) <= 200),
  weaknesses_text text CHECK (weaknesses_text IS NULL OR char_length(weaknesses_text) <= 200),
  target_goal_text text CHECK (target_goal_text IS NULL OR char_length(target_goal_text) <= 200),
  -- C3 default for learners/children: shared with matched tutors on cases.
  share_with_tutors boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One snapshot per learner ("Myself" = child_profile_id IS NULL).
CREATE UNIQUE INDEX IF NOT EXISTS uq_learner_snapshot
  ON public.learner_snapshots (owner_user_id, COALESCE(child_profile_id::text, ''));

CREATE TABLE IF NOT EXISTS public.academic_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_profile_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN (
    'early_years', 'primary', 'secondary', 'post_secondary',
    'extracurricular_award', 'certification_language'
  )),
  institution_or_issuer text NOT NULL CHECK (char_length(institution_or_issuer) <= 120),
  title_or_program text NOT NULL CHECK (char_length(title_or_program) <= 160),
  curriculum_or_body text CHECK (curriculum_or_body IS NULL OR char_length(curriculum_or_body) <= 60),
  start_year integer CHECK (start_year IS NULL OR start_year BETWEEN 1990 AND 2100),
  end_year integer CHECK (end_year IS NULL OR end_year BETWEEN 1990 AND 2100),
  is_current boolean NOT NULL DEFAULT false,
  grades_or_results text CHECK (grades_or_results IS NULL OR char_length(grades_or_results) <= 300),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 300),
  -- C3 visibility: private (only me) | matched_tutors | public_tutor
  -- (public only ever applies to self-owned records in Teaching Mode).
  visibility text NOT NULL DEFAULT 'matched_tutors'
    CHECK (visibility IN ('private', 'matched_tutors', 'public_tutor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academic_records_year_order CHECK (
    start_year IS NULL OR end_year IS NULL OR is_current OR end_year >= start_year
  )
);

CREATE INDEX IF NOT EXISTS idx_academic_records_owner
  ON public.academic_records (owner_user_id, child_profile_id);

ALTER TABLE public.learner_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.learner_snapshots FROM anon, authenticated;
REVOKE ALL ON public.academic_records FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learner_snapshots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_records TO service_role;

COMMENT ON TABLE public.learner_snapshots IS
  'Issue #545: per-learner diagnostic summary (level, strengths, needs, goal) + tutor-share toggle. Service-role only via academic-records.functions.ts.';
COMMENT ON TABLE public.academic_records IS
  'Issue #545: lifelong academic & achievement timeline (6 categories, per-record visibility). Service-role only via academic-records.functions.ts.';
