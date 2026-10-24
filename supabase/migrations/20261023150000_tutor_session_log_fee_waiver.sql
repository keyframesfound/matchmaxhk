-- Issue #431 / GLM round-1 MAJOR follow-up (2026-10-23, Ryan-approved):
-- the insert guard required the 1.5-lesson admin fee to be status='paid'
-- EXACTLY, so an admin-WAIVED case could never log a session — the tutor's
-- experience never accrues there and the desk shows a logging form the
-- server always rejects. The repo's own #425 review-fee precedent treats
-- paid OR waived as obligation met; the gate now matches (client flag +
-- canLogOnCase + this trigger all aligned on the same rule).
--
-- Re-emits the guard function WHOLESALE from the 20261023140000 definition
-- (time rules folded in there) with only the fee predicate changed —
-- CREATE OR REPLACE replaces the prior definition, so this file is
-- self-contained and idempotent.

CREATE OR REPLACE FUNCTION public.tutor_session_log_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Time rules (INSERT-time — moved from the dropped now()-based CHECK in
  -- 20261023140000): no future HKT dates; max 7-day backdating window.
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
    WHERE f.case_id = NEW.case_id AND f.status IN ('paid', 'waived')
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

-- Trigger binding re-asserted defensively (self-contained migration).
DROP TRIGGER IF EXISTS trg_tutor_session_log_guard ON public.tutor_session_logs;
CREATE TRIGGER trg_tutor_session_log_guard
  BEFORE INSERT ON public.tutor_session_logs
  FOR EACH ROW EXECUTE FUNCTION public.tutor_session_log_guard();
