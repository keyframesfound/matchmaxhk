-- Issue #828: the tutor session log feeds verified hours, and a double
-- submit cannot double-credit.
--
-- Three gaps closed here, all in the same money/trust path:
--
--   AC-A1  tutor_session_logs had no private note and no client_request_id,
--          so a retry could create a second row. case_lessons already solved
--          this (#461); the log gets the same shape.
--   AC-A4  the log never reached verified_hours_ledger at all. Only
--          case_lessons did, so a tutor logging Lesson 3+ accrued zero public
--          hours. The ledger now carries session_log_id and the sweep writes
--          the row when a log verifies.
--   AC-A5  the sweep ran on a 72h clock while the ledger's AUTO_VERIFY_HOURS
--          is 24h. One clock now: 24h.
--
-- Idempotent: add column if not exists, create index if not exists,
-- create or replace function, drop trigger if exists.

-- ---------------------------------------------------------------------------
-- AC-A1: retry-proof logging + a private note (never shown to the family)
-- ---------------------------------------------------------------------------
ALTER TABLE public.tutor_session_logs
  ADD COLUMN IF NOT EXISTS private_note text
    CHECK (private_note IS NULL OR char_length(private_note) <= 500),
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tutor_session_logs_client_request_id
  ON public.tutor_session_logs (client_request_id)
  WHERE client_request_id IS NOT NULL;

COMMENT ON COLUMN public.tutor_session_logs.private_note IS
  'Tutor-only note (#828 AC-A1). Never rendered to the parent or on any public surface.';
COMMENT ON COLUMN public.tutor_session_logs.client_request_id IS
  'UI-generated UUID so a double submit creates one row (#828 AC-A1, #461 precedent).';

-- ---------------------------------------------------------------------------
-- AC-A4: one ledger row per verified log, never two
-- ---------------------------------------------------------------------------
ALTER TABLE public.verified_hours_ledger
  ADD COLUMN IF NOT EXISTS session_log_id uuid
    REFERENCES public.tutor_session_logs(id) ON DELETE SET NULL;

-- Plain unique index: Postgres treats NULLs as distinct, so legacy rows without
-- a log keep working, and `on conflict (session_log_id)` can infer this one.
DROP INDEX IF EXISTS public.uq_hours_ledger_session_log;
CREATE UNIQUE INDEX IF NOT EXISTS uq_hours_ledger_session_log
  ON public.verified_hours_ledger (session_log_id);

COMMENT ON COLUMN public.verified_hours_ledger.session_log_id IS
  'Issue #828: the tutor_session_logs row this credit came from. Unique, so a re-run of the sweep cannot double-credit.';

-- ---------------------------------------------------------------------------
-- AC-A4 / AC-A5: 24h sweep that credits the ledger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sweep_due_tutor_session_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _due record;
  _flipped integer := 0;
BEGIN
  -- Row-by-row so the ledger insert and the status flip cannot drift apart,
  -- and so one bad row cannot abort the whole platform-wide sweep.
  FOR _due IN
    SELECT id, case_id, tutor_id, log_date, start_minute, duration_min
      FROM public.tutor_session_logs
     WHERE status = 'pending'
       AND created_at <= now() - interval '24 hours'
     ORDER BY created_at
     FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.tutor_session_logs
       SET status = 'verified',
           verified_at = now()
     WHERE id = _due.id
       AND status = 'pending';

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    INSERT INTO public.verified_hours_ledger (
      session_log_id, case_id, tutor_id, student_id,
      duration_hours, occurred_at, status, verified_at, verified_by
    )
    SELECT
      _due.id,
      _due.case_id,
      _due.tutor_id,
      c.student_id,
      round(GREATEST(_due.duration_min, 1)::numeric / 60, 2),
      ((_due.log_date::timestamp + make_interval(mins => _due.start_minute))
        AT TIME ZONE 'Asia/Hong_Kong'),
      'verified_completed',
      now(),
      'auto'
    FROM public.tutoring_cases c
    WHERE c.id = _due.case_id
    ON CONFLICT (session_log_id) DO NOTHING;

    _flipped := _flipped + 1;
  END LOOP;

  RETURN _flipped;
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_due_tutor_session_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_due_tutor_session_logs() TO service_role;

-- ---------------------------------------------------------------------------
-- AC-A4: a dispute or revoke must drop the public hours again
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_hours_ledger_from_session_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('disputed', 'revoked') THEN
    UPDATE public.verified_hours_ledger
       SET status = 'cancelled',
           verified_at = NULL,
           updated_at = now()
     WHERE session_log_id = NEW.id
       AND status <> 'cancelled';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_hours_ledger_from_session_log() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_session_log_hours_ledger ON public.tutor_session_logs;
CREATE TRIGGER trg_session_log_hours_ledger
  AFTER UPDATE OF status ON public.tutor_session_logs
  FOR EACH ROW EXECUTE FUNCTION public.sync_hours_ledger_from_session_log();

-- One-off catch-up: logs already verified (by the old 72h sweep) should carry
-- their credit now rather than waiting for a future verify that never comes.
INSERT INTO public.verified_hours_ledger (
  session_log_id, case_id, tutor_id, student_id,
  duration_hours, occurred_at, status, verified_at, verified_by
)
SELECT
  l.id, l.case_id, l.tutor_id, c.student_id,
  round(GREATEST(l.duration_min, 1)::numeric / 60, 2),
  ((l.log_date::timestamp + make_interval(mins => l.start_minute))
    AT TIME ZONE 'Asia/Hong_Kong'),
  'verified_completed', now(), 'auto'
FROM public.tutor_session_logs l
JOIN public.tutoring_cases c ON c.id = l.case_id
WHERE l.status = 'verified'
ON CONFLICT (session_log_id) DO NOTHING;
