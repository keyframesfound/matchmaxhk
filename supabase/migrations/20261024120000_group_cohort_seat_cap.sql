-- Issue #391 follow-up: race-free seat cap.
--
-- bookGroupCohort derives seats then inserts; two concurrent bookings of the
-- last seat can both pass the check-then-insert. This trigger serializes all
-- cohort-linked case writes on a FOR UPDATE row lock of the cohort and
-- re-checks the derived sum, so the hard 2–6 Cap. 279 band holds under races
-- (the app-side check stays as the friendly pre-flight error).
--
-- Seat derivation mirrors src/features/cases/group-cohorts.ts: only
-- new/contacted/matched hold seats; closed/rejected (and legacy enum values)
-- free them. staff/admin inserts and edits go through the same guard — to
-- overbook deliberately, raise the cohort's max_seats first.

CREATE OR REPLACE FUNCTION public.enforce_group_cohort_seat_cap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_max_seats integer;
  v_taken integer;
BEGIN
  -- Non-holding statuses never occupy (or release-constrain) seats.
  IF NEW.status NOT IN ('new', 'contacted', 'matched') THEN
    RETURN NEW;
  END IF;

  -- Row lock serializes concurrent bookings on the same cohort.
  SELECT max_seats INTO v_max_seats
  FROM public.group_cohorts
  WHERE id = NEW.group_cohort_id
  FOR UPDATE;
  IF NOT FOUND THEN
    -- Cohort deleted concurrently (FK ON DELETE SET NULL path).
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(student_count), 0)::integer INTO v_taken
  FROM public.tutoring_cases
  WHERE group_cohort_id = NEW.group_cohort_id
    AND id <> NEW.id -- UPDATE self-exclusion; NEW.id is fresh on INSERT
    AND status IN ('new', 'contacted', 'matched');

  IF v_taken + NEW.student_count > v_max_seats THEN
    RAISE EXCEPTION 'COHORT_SEAT_CAP_EXCEEDED' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tutoring_cases_cohort_seat_cap
  BEFORE INSERT OR UPDATE OF student_count, group_cohort_id, status
  ON public.tutoring_cases
  FOR EACH ROW
  WHEN (NEW.group_cohort_id IS NOT NULL)
  EXECUTE FUNCTION public.enforce_group_cohort_seat_cap();
