-- Issue #387 — Tutor Verified Experience Log.
--
-- tutors cannot type totals: the public numbers are computed STRICTLY from
-- (a) intro lessons = case_lessons sequence 1/2 with status 'done' (scheduled
-- duration) and (b) tutor_session_logs rows with status 'verified'. Group
-- sessions count once by construction — one row per SESSION, never per
-- student — so no multiplication happens anywhere in the pipeline.
--
-- Guardrails live in BOTH places: CHECK constraints + insert trigger here,
-- and the pure helpers in src/features/tutors/experience.ts (vitest-tested)
-- that the server fns call first.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tutor_session_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.tutoring_cases(id) ON DELETE CASCADE,
  tutor_id UUID NOT NULL REFERENCES public.tutors(id) ON DELETE CASCADE,
  -- HKT calendar day of the session (max 1 logged session per case per day).
  log_date DATE NOT NULL,
  -- Minutes-from-midnight HKT; the session may not cross midnight.
  start_minute INT NOT NULL,
  -- 0.5h increments 0.5h–4.0h.
  duration_min INT NOT NULL CHECK (
    duration_min >= 30 AND duration_min <= 240 AND duration_min % 30 = 0
  ),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'disputed', 'revoked')),
  disputed_at TIMESTAMPTZ,
  dispute_reason TEXT,
  verified_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Guardrails expressible as constraints:
  --  * no future dates + max 7-day backdating window (HKT today),
  --  * no session crossing midnight,
  --  * max 1 logged session per calendar day per Case.
  CONSTRAINT tutor_session_logs_no_future_or_far_past CHECK (
    log_date <= (now() AT TIME ZONE 'Asia/Hong_Kong')::DATE
    AND log_date >= (now() AT TIME ZONE 'Asia/Hong_Kong')::DATE - 7
  ),
  CONSTRAINT tutor_session_logs_within_day CHECK (
    start_minute >= 0 AND start_minute < 1440
    AND start_minute + duration_min <= 1440
  ),
  CONSTRAINT tutor_session_logs_unique_case_day UNIQUE (case_id, log_date),
  -- dispute fields only make sense on a disputed row.
  CONSTRAINT tutor_session_logs_dispute_coherent CHECK (
    (status = 'disputed') = (disputed_at IS NOT NULL)
    AND (dispute_reason IS NULL OR length(btrim(dispute_reason)) <= 500)
  )
);

CREATE INDEX IF NOT EXISTS idx_tutor_session_logs_tutor_status
  ON public.tutor_session_logs (tutor_id, status);
CREATE INDEX IF NOT EXISTS idx_tutor_session_logs_case
  ON public.tutor_session_logs (case_id, log_date DESC);

-- RLS on, ZERO client grants — every write goes through service-role server
-- fns; the only public read is the aggregate RPC below.
ALTER TABLE public.tutor_session_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tutor_session_logs FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutor_session_logs TO service_role;

-- ---------------------------------------------------------------------------
-- Insert guardrail trigger (backstop for out-of-band writes):
--  * only the case's matched tutor logs,
--  * the 1.5-lesson admin fee must be marked paid,
--  * after 2 disputed logs on a Case the tutor can no longer log on it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tutor_session_log_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tutoring_cases c
    WHERE c.id = NEW.case_id AND c.matched_tutor_id = NEW.tutor_id
  ) THEN
    RAISE EXCEPTION 'CASE_TUTOR_MISMATCH';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.case_fees f
    WHERE f.case_id = NEW.case_id AND f.status = 'paid'
  ) THEN
    RAISE EXCEPTION 'FEE_NOT_PAID';
  END IF;
  IF (
    SELECT count(*) FROM public.tutor_session_logs l
    WHERE l.case_id = NEW.case_id AND l.status = 'disputed'
  ) >= 2 THEN
    RAISE EXCEPTION 'DISPUTE_LOCK';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tutor_session_log_guard ON public.tutor_session_logs;
CREATE TRIGGER trg_tutor_session_log_guard
  BEFORE INSERT ON public.tutor_session_logs
  FOR EACH ROW EXECUTE FUNCTION public.tutor_session_log_guard();

-- ---------------------------------------------------------------------------
-- 72h auto-verify sweep (lazy, called on reads from server fns — the
-- sweep_past_due_gig_orders pattern). A pending log older than 72h without a
-- dispute becomes verified. Mutating: locked to service_role.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sweep_due_tutor_session_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  flipped integer;
BEGIN
  UPDATE public.tutor_session_logs
  SET status = 'verified',
      verified_at = now()
  WHERE status = 'pending'
    AND created_at <= now() - interval '72 hours';
  GET DIAGNOSTICS flipped = ROW_COUNT;
  RETURN flipped;
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_due_tutor_session_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_due_tutor_session_logs() TO service_role;

-- ---------------------------------------------------------------------------
-- Public aggregate: lessons / hours / first / last verified session.
-- Intro lessons count on the case's matched tutor (sequence 1–2, done);
-- ongoing sessions count only when verified. Disputed + revoked rows count 0.
-- SECURITY DEFINER so anon can read the aggregate without table grants.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_tutor_experience(p_tutor uuid)
RETURNS TABLE (
  total_lessons bigint,
  total_hours numeric,
  first_lesson_at timestamptz,
  last_lesson_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH intro AS (
    SELECT cl.starts_at AS at_ts, cl.duration_min
    FROM public.case_lessons cl
    JOIN public.tutoring_cases c ON c.id = cl.case_id
    WHERE c.matched_tutor_id = p_tutor
      AND cl.sequence IN (1, 2)
      AND cl.status = 'done'
  ),
  logs AS (
    SELECT
      ((l.log_date::timestamp + make_interval(mins => l.start_minute))
        AT TIME ZONE 'Asia/Hong_Kong') AS at_ts,
      l.duration_min
    FROM public.tutor_session_logs l
    WHERE l.tutor_id = p_tutor
      AND l.status = 'verified'
  ),
  sessions AS (
    SELECT * FROM intro
    UNION ALL
    SELECT * FROM logs
  )
  SELECT
    count(*)::bigint,
    (coalesce(sum(duration_min), 0) / 60.0)::numeric,
    min(at_ts),
    max(at_ts)
  FROM sessions;
$$;

-- Read-only aggregate for the public card/profile pill: anon may execute.
REVOKE ALL ON FUNCTION public.get_tutor_experience(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tutor_experience(uuid) TO anon, authenticated;
