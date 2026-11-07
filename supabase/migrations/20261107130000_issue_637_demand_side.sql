-- #637: Demand-Side self-info for the Party Case Hub. Never public. Kept apart
-- from tutoring_cases so these edits cannot touch rate, fee or the tutor.
-- Service-role only: RLS on with no policies, access checks run in server fns.
CREATE TABLE IF NOT EXISTS public.case_demand_side (
  case_id uuid PRIMARY KEY REFERENCES public.tutoring_cases(id) ON DELETE CASCADE,
  primary_goal text CHECK (primary_goal IN ('exam_boost', 'foundation', 'homework')),
  language_medium text CHECK (language_medium IN ('cantonese_en_terms', 'english', 'putonghua')),
  household_notes text NOT NULL DEFAULT '',
  feedback_style text CHECK (feedback_style IN ('weekly', 'monthly')),
  current_level text NOT NULL DEFAULT '',
  target_grade text NOT NULL DEFAULT '',
  weak_topics text[] NOT NULL DEFAULT '{}',
  learning_styles text[] NOT NULL DEFAULT '{}',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.case_demand_side ENABLE ROW LEVEL SECURITY;

-- Saved "use for my future cases" household notes. Seeds new cases only.
CREATE TABLE IF NOT EXISTS public.household_defaults (
  user_id uuid PRIMARY KEY,
  defaults jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.household_defaults ENABLE ROW LEVEL SECURITY;
