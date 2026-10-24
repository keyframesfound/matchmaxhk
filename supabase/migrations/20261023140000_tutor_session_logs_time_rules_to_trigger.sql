-- Issue #431 / GLM round-2 blocker (2026-10-23): the
-- tutor_session_logs_no_future_or_far_past CHECK embedded now(), so Postgres
-- re-evaluated it on EVERY row UPDATE (verified empirically on live Postgres
-- — CHECK constraints with volatile functions re-run on all updates, even
-- ones that never touch log_date). Three reachable breaks:
--   * sweep_due_tutor_session_logs (single UPDATE) aborts when ANY due
--     pending row has aged out of the 7-day window — backdating to
--     today-7 is a DESIGNED feature, so such rows exist by design and the
--     whole sweep dies silently platform-wide (auto-verify dead, countdown
--     lies, experience never accrues);
--   * revokeSession throws a raw PG error for every log older than ~7 days
--     — exactly the fraud-remediation path the desk Revoke exists for;
--   * disputeSession throws raw PG errors at parents for aged pending rows.
-- The two time rules are INSERT-time rules by nature: DROP the CHECK and
-- enforce them in the BEFORE INSERT guard trigger instead. INSERT
-- enforcement stays identical; UPDATE paths stop re-validating time.
-- (Secondary benefit: valid old rows survive pg_dump/restore re-insert.)

ALTER TABLE public.tutor_session_logs
  DROP CONSTRAINT IF EXISTS tutor_session_logs_no_future_or_far_past;

-- Re-emit the guard trigger with the time rules folded in (full body —
-- CREATE OR REPLACE replaces the prior definition wholesale).
CREATE OR REPLACE FUNCTION public.tutor_session_log_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Time rules (moved from the now()-based CHECK above — see header):
  --  * no future dates (HKT today),
  --  * max 7-day backdating window.
  IF NEW.log_date > (now() AT TIME ZONE 'Asia/Hong_Kong')::DATE THEN
    RAISE EXCEPTION 'LOG_DATE_IN_FUTURE';
  END IF;
  IF NEW.log_date < (now() AT TIME ZONE 'Asia/Hong_Kong')::DATE - 7 THEN
    RAISE EXCEPTION 'LOG_DATE_TOO_FAR_PAST';
  END IF;
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

-- The trigger binding itself is unchanged (BEFORE INSERT, per row) —
-- re-asserted defensively so this migration is self-contained.
DROP TRIGGER IF EXISTS trg_tutor_session_log_guard ON public.tutor_session_logs;
CREATE TRIGGER trg_tutor_session_log_guard
  BEFORE INSERT ON public.tutor_session_logs
  FOR EACH ROW EXECUTE FUNCTION public.tutor_session_log_guard();
