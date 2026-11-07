-- #657: ranked waves of 3 for case match alerts. One run per case plus its
-- ranked tutor queue. Service-role only: RLS on with no policies, the desk
-- panel and the bus tick read through server functions.
CREATE TABLE IF NOT EXISTS public.case_match_runs (
  case_id uuid PRIMARY KEY REFERENCES public.tutoring_cases(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'responded', 'paused', 'exhausted', 'stopped')),
  current_wave integer NOT NULL DEFAULT 0,
  next_wave_at timestamptz,
  match_fingerprint text,
  stop_reason text,
  taken_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.case_match_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.case_match_runs(case_id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES public.tutors(id) ON DELETE CASCADE,
  score numeric NOT NULL,
  rank integer NOT NULL,
  wave_no integer,
  notified_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, tutor_id)
);

CREATE INDEX IF NOT EXISTS idx_case_match_queue_tutor ON public.case_match_queue (tutor_id);
CREATE INDEX IF NOT EXISTS idx_case_match_runs_open ON public.case_match_runs (status)
  WHERE status <> 'stopped';

ALTER TABLE public.case_match_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_match_queue ENABLE ROW LEVEL SECURITY;
