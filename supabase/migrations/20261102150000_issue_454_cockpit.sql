-- #454 Brain-Dead Matching Cockpit: case states + desk tools.
--   * tutoring_cases.group_size  1_ON_1 | GROUP_2_3 (default 1_ON_1)
--   * tutoring_cases.market_min_hkd / market_max_hkd — manual Master Sheet
--     subject rate band pasted by the desk (no scrape in V1)
--   * case_request_status + 'released' (24h silent chase → RELEASED)
--     ('failed_trial_pivot' already shipped with #449)
--   * case_tutor_declines — tutor "no" on a ping: SCHEDULE | RATE | OTHER
--   * desk_fast_pins — editable fast-tutor pins per subject
-- Staff-only tables: RLS on, no client policies; server fns use service role.
-- Apply via Supabase MCP apply_migration.

ALTER TYPE public.case_request_status ADD VALUE IF NOT EXISTS 'released' BEFORE 'closed';

ALTER TABLE public.tutoring_cases
  ADD COLUMN IF NOT EXISTS group_size text NOT NULL DEFAULT '1_ON_1',
  ADD COLUMN IF NOT EXISTS market_min_hkd integer,
  ADD COLUMN IF NOT EXISTS market_max_hkd integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tutoring_cases_group_size_check'
  ) THEN
    ALTER TABLE public.tutoring_cases
      ADD CONSTRAINT tutoring_cases_group_size_check
      CHECK (group_size IN ('1_ON_1', 'GROUP_2_3'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tutoring_cases_market_band_check'
  ) THEN
    ALTER TABLE public.tutoring_cases
      ADD CONSTRAINT tutoring_cases_market_band_check
      CHECK (
        (market_min_hkd IS NULL OR market_min_hkd > 0)
        AND (market_max_hkd IS NULL OR market_max_hkd > 0)
        AND (market_min_hkd IS NULL OR market_max_hkd IS NULL OR market_min_hkd <= market_max_hkd)
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.case_tutor_declines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.tutoring_cases(id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES public.tutors(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('SCHEDULE', 'RATE', 'OTHER')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_case_tutor_declines_case ON public.case_tutor_declines (case_id);
ALTER TABLE public.case_tutor_declines ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.desk_fast_pins (
  subject text PRIMARY KEY CHECK (length(subject) BETWEEN 1 AND 80),
  tutor_ids uuid[] NOT NULL DEFAULT '{}',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.desk_fast_pins ENABLE ROW LEVEL SECURITY;
