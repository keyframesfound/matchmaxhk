-- Issue #712 AC-3: verified hours credit the moment both sides confirm.
--
-- #459 wrote every done lesson into verified_hours_ledger as
-- pending_confirmation and let verify_due_hours() flip it after 24h. That
-- deferred the public tutoring-hours counter even when the tutor had logged
-- the lesson and the parent had already confirmed it.
--
-- What changes (nothing else):
--   lesson -> done with BOTH confirmations already stamped
--     : ledger row is written verified_completed / verified_by = 'auto' / now()
--   second confirmation arrives on an already-done lesson
--     : the pending_confirmation row is promoted to verified_completed
--   disputing is still a staff/parent action; cancelled rows are never
--   resurrected and disputed rows are never overwritten.
--
-- Still unchanged: done + 0/1 confirmation stays pending_confirmation and
-- auto-verifies after 24h; leaving 'done' cancels; rows are never deleted.
-- Idempotent: create or replace function + drop trigger if exists.

CREATE OR REPLACE FUNCTION public.sync_hours_ledger_from_lesson()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_done boolean := COALESCE(NEW.status = 'done', false);
  _was_done boolean := (TG_OP = 'UPDATE' AND OLD.status = 'done');
  -- Both parties signed off: no reason to wait out the 24h auto-verify.
  _bilateral boolean :=
    NEW.confirmed_by_parent_at IS NOT NULL AND NEW.confirmed_by_tutor_at IS NOT NULL;
BEGIN
  IF _is_done AND NOT _was_done THEN
    -- Entered done (staff desk, #533 attendance, import). Credit straight away
    -- when both confirmations are already stamped, otherwise stay pending.
    INSERT INTO public.verified_hours_ledger (
      case_lesson_id, case_id, tutor_id, student_id, duration_hours, occurred_at,
      status, verified_at, verified_by
    )
    SELECT NEW.id, NEW.case_id, NEW.tutor_id, c.student_id,
           round(GREATEST(NEW.duration_min, 1)::numeric / 60, 2), NEW.starts_at,
           CASE WHEN _bilateral THEN 'verified_completed' ELSE 'pending_confirmation' END,
           CASE WHEN _bilateral THEN now() END,
           CASE WHEN _bilateral THEN 'auto' END
    FROM public.tutoring_cases c
    WHERE c.id = NEW.case_id
    ON CONFLICT (case_lesson_id) DO UPDATE
      SET status = CASE WHEN _bilateral THEN 'verified_completed' ELSE 'pending_confirmation' END,
          pending_since = now(),
          verified_at = CASE WHEN _bilateral THEN now() END,
          verified_by = CASE WHEN _bilateral THEN 'auto' END,
          updated_at = now()
      WHERE public.verified_hours_ledger.status = 'cancelled';
  ELSIF _is_done AND _was_done THEN
    -- The remaining confirmation landed on a lesson that was already done.
    -- Only a pending row is promoted: never resurrect cancelled, never
    -- overwrite a dispute a human has to resolve.
    IF _bilateral THEN
      UPDATE public.verified_hours_ledger
      SET status = 'verified_completed',
          verified_at = now(),
          verified_by = 'auto',
          updated_at = now()
      WHERE case_lesson_id = NEW.id
        AND status = 'pending_confirmation';
    END IF;
  ELSIF _was_done AND NEW.status <> 'done' THEN
    UPDATE public.verified_hours_ledger
    SET status = 'cancelled', verified_at = NULL, updated_at = now()
    WHERE case_lesson_id = NEW.id AND status <> 'cancelled';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_hours_ledger_from_lesson() FROM PUBLIC, anon, authenticated;

-- Fire on the confirmation stamps as well as status: a parent confirming a
-- done lesson is what closes the loop above.
DROP TRIGGER IF EXISTS trg_case_lessons_hours_ledger ON public.case_lessons;
CREATE TRIGGER trg_case_lessons_hours_ledger
  AFTER INSERT OR UPDATE OF status, confirmed_by_parent_at, confirmed_by_tutor_at
  ON public.case_lessons
  FOR EACH ROW EXECUTE FUNCTION public.sync_hours_ledger_from_lesson();

-- One-off catch-up: done lessons both sides had already confirmed before this
-- migration should not sit pending until the hourly sweep reaches them.
UPDATE public.verified_hours_ledger v
SET status = 'verified_completed',
    verified_at = now(),
    verified_by = 'auto',
    updated_at = now()
FROM public.case_lessons l
WHERE v.case_lesson_id = l.id
  AND v.status = 'pending_confirmation'
  AND l.status = 'done'
  AND l.confirmed_by_parent_at IS NOT NULL
  AND l.confirmed_by_tutor_at IS NOT NULL;
