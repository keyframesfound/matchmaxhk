-- Issue #459 slice 3: dual-sided verified hours ledger.
--
-- One row per taught lesson credits teaching hours to the tutor and
-- learning hours to the child sub-profile (tutoring_cases.student_id, when
-- the case has one). Public hour counters are SUM(duration_hours) over
-- verified_completed rows only; nothing else writes hours.
--
-- Lifecycle (bridged from case_lessons until #461's session model lands):
--   lesson status -> 'done'      : row inserted pending_confirmation
--   parent confirms              : verified_completed (verified_by = parent)
--   parent disputes              : disputed (no credit until staff resolve)
--   24h with no answer (cron)    : verified_completed (verified_by = auto)
--   lesson leaves 'done' (void)  : cancelled; re-done reopens it as pending
--
-- Rows are never deleted (audit); only status/verify/dispute fields change.
-- Service-role only like students: RLS on, no anon/authenticated grants.

CREATE TABLE IF NOT EXISTS public.verified_hours_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL DEFAULT 'one_on_one_lesson'
    CHECK (source_type IN ('one_on_one_lesson', 'group_centre_class', 'platform_event_workshop')),
  status text NOT NULL DEFAULT 'pending_confirmation'
    CHECK (status IN ('pending_confirmation', 'verified_completed', 'disputed', 'cancelled')),
  -- SET NULL, not RESTRICT: case_lessons cascades from tutoring_cases, and
  -- admins delete cases. The row survives for audit, cancelled first by
  -- trg_case_lessons_hours_ledger_delete.
  case_lesson_id uuid UNIQUE REFERENCES public.case_lessons(id) ON DELETE SET NULL,
  case_id uuid REFERENCES public.tutoring_cases(id) ON DELETE SET NULL,
  tutor_id uuid REFERENCES public.tutors(id) ON DELETE SET NULL,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  duration_hours numeric(6,2) NOT NULL CHECK (duration_hours > 0),
  occurred_at timestamptz NOT NULL,
  pending_since timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  verified_by text CHECK (verified_by IS NULL OR verified_by IN ('parent', 'auto', 'staff')),
  disputed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  dispute_reason text CHECK (dispute_reason IS NULL OR char_length(dispute_reason) BETWEEN 3 AND 500),
  disputed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT verified_hours_ledger_verified_coherent
    CHECK ((status = 'verified_completed') = (verified_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_hours_ledger_tutor_verified
  ON public.verified_hours_ledger (tutor_id) WHERE status = 'verified_completed';
CREATE INDEX IF NOT EXISTS idx_hours_ledger_student_verified
  ON public.verified_hours_ledger (student_id) WHERE status = 'verified_completed';
CREATE INDEX IF NOT EXISTS idx_hours_ledger_pending
  ON public.verified_hours_ledger (pending_since) WHERE status = 'pending_confirmation';

ALTER TABLE public.verified_hours_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.verified_hours_ledger FROM anon, authenticated;

COMMENT ON TABLE public.verified_hours_ledger IS
  'Issue #459: append-only verified hours. Public teaching/learning hours = SUM(duration_hours) WHERE status = verified_completed.';

-- Append-only: block deletes even from the service role.
CREATE OR REPLACE FUNCTION public.verified_hours_ledger_no_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'verified_hours_ledger rows are never deleted; set status = cancelled';
END;
$$;

DROP TRIGGER IF EXISTS trg_verified_hours_ledger_no_delete ON public.verified_hours_ledger;
CREATE TRIGGER trg_verified_hours_ledger_no_delete
  BEFORE DELETE ON public.verified_hours_ledger
  FOR EACH ROW EXECUTE FUNCTION public.verified_hours_ledger_no_delete();

-- Bridge writer: every path that marks a lesson done (staff desk, #533
-- attendance, import) goes through case_lessons.status, so the trigger
-- covers them all.
CREATE OR REPLACE FUNCTION public.sync_hours_ledger_from_lesson()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'done' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'done') THEN
    INSERT INTO public.verified_hours_ledger (
      case_lesson_id, case_id, tutor_id, student_id, duration_hours, occurred_at
    )
    SELECT NEW.id, NEW.case_id, NEW.tutor_id, c.student_id,
           round(GREATEST(NEW.duration_min, 1)::numeric / 60, 2), NEW.starts_at
    FROM public.tutoring_cases c
    WHERE c.id = NEW.case_id
    ON CONFLICT (case_lesson_id) DO UPDATE
      SET status = 'pending_confirmation',
          pending_since = now(),
          verified_at = NULL,
          verified_by = NULL,
          updated_at = now()
      WHERE public.verified_hours_ledger.status = 'cancelled';
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'done' AND NEW.status <> 'done' THEN
    UPDATE public.verified_hours_ledger
    SET status = 'cancelled', verified_at = NULL, updated_at = now()
    WHERE case_lesson_id = NEW.id AND status <> 'cancelled';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_case_lessons_hours_ledger ON public.case_lessons;
CREATE TRIGGER trg_case_lessons_hours_ledger
  AFTER INSERT OR UPDATE OF status ON public.case_lessons
  FOR EACH ROW EXECUTE FUNCTION public.sync_hours_ledger_from_lesson();

-- A deleted lesson (directly or via case delete) stops counting.
CREATE OR REPLACE FUNCTION public.cancel_hours_ledger_for_deleted_lesson()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.verified_hours_ledger
  SET status = 'cancelled', verified_at = NULL, updated_at = now()
  WHERE case_lesson_id = OLD.id AND status <> 'cancelled';
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_case_lessons_hours_ledger_delete ON public.case_lessons;
CREATE TRIGGER trg_case_lessons_hours_ledger_delete
  BEFORE DELETE ON public.case_lessons
  FOR EACH ROW EXECUTE FUNCTION public.cancel_hours_ledger_for_deleted_lesson();

-- Auto-verify anything the parent left pending for 24h (AUTO_VERIFY_HOURS
-- in src/features/hours/hours.ts).
CREATE OR REPLACE FUNCTION public.verify_due_hours()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  UPDATE public.verified_hours_ledger
  SET status = 'verified_completed',
      verified_at = now(),
      verified_by = 'auto',
      updated_at = now()
  WHERE status = 'pending_confirmation'
    AND pending_since <= now() - interval '24 hours';
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_due_hours() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_hours_ledger_from_lesson() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_hours_ledger_for_deleted_lesson() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'verify-due-hours';
    PERFORM cron.schedule('verify-due-hours', '7 * * * *', 'SELECT public.verify_due_hours();');
  END IF;
END;
$$;

-- Backfill lessons already done before this migration.
INSERT INTO public.verified_hours_ledger (
  case_lesson_id, case_id, tutor_id, student_id, duration_hours, occurred_at
)
SELECT l.id, l.case_id, l.tutor_id, c.student_id,
       round(GREATEST(l.duration_min, 1)::numeric / 60, 2), l.starts_at
FROM public.case_lessons l
JOIN public.tutoring_cases c ON c.id = l.case_id
WHERE l.status = 'done'
ON CONFLICT (case_lesson_id) DO NOTHING;
