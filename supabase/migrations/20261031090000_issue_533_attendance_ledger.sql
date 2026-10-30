-- #533 (#530 Phase 1): attendance + soft note gate + credit ledger on the
-- existing case_lessons calendar (extends #461; no second calendar).
--
-- Hybrid lock (#530 §0):
--   * Attendance statuses work on every lesson.
--   * Only MANAGED cases (tutoring_cases.managed + credit_account_id) touch
--     the #532 ledger and get the note gate; pure-matching cases are unchanged.
--
-- Ledger state machine for a managed lesson (trigger below, one place for
-- every writer: tutor hub, admin desk, imports):
--   BOOKED  insert / move back to planned|confirmed  -> HOLD 1 credit
--   settle  attendance present|late|left_early|absent_billable, done, no_show
--           -> CONSUME (+ payout_status PENDING_PAYOUT)
--           attendance absent_excused, cancelled -> RELEASE
--           late_cancel -> cancellation_policy.late_cancel_billable ? CONSUME : RELEASE
-- Idempotency keys hold:lesson:<id> / settle:lesson:<id>, so a duplicate submit
-- never double-consumes. A lesson created from a #532 reservation passes its
-- hold_entry_id and is not held twice.
--
-- Posture: new tutoring_cases columns get no authenticated grant (staff-only,
-- column-level grants since 20261026000000). case_lessons stays service-role.

ALTER TABLE public.tutoring_cases
  ADD COLUMN IF NOT EXISTS managed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS credit_account_id uuid REFERENCES public.credit_accounts(id),
  -- Policies as data. Hours mirror the live #204 12h late-cancel rule.
  ADD COLUMN IF NOT EXISTS cancellation_policy jsonb NOT NULL
    DEFAULT '{"free_cancel_hours": 12, "late_cancel_billable": true}'::jsonb,
  ADD COLUMN IF NOT EXISTS reschedule_policy jsonb NOT NULL
    DEFAULT '{"free_reschedule_hours": 12, "max_reschedules_per_lesson": 2}'::jsonb;

DO $$
BEGIN
  ALTER TABLE public.tutoring_cases
    ADD CONSTRAINT tutoring_cases_managed_needs_account
    CHECK (NOT managed OR credit_account_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

COMMENT ON COLUMN public.tutoring_cases.managed IS
  '#530 Hybrid: optional MatchMax Managed tier. Default false = pure matching (no ledger, no note gate).';

ALTER TABLE public.case_lessons
  ADD COLUMN IF NOT EXISTS attendance text
    CHECK (attendance IS NULL OR attendance IN
      ('present', 'late', 'left_early', 'absent_excused', 'absent_billable')),
  ADD COLUMN IF NOT EXISTS attendance_note text
    CHECK (attendance_note IS NULL OR char_length(attendance_note) <= 1000),
  ADD COLUMN IF NOT EXISTS note_skipped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS note_override_by uuid,
  ADD COLUMN IF NOT EXISTS attendance_marked_at timestamptz,
  ADD COLUMN IF NOT EXISTS attendance_marked_by uuid,
  ADD COLUMN IF NOT EXISTS hold_entry_id uuid REFERENCES public.credit_ledger_entries(id),
  ADD COLUMN IF NOT EXISTS settle_entry_id uuid REFERENCES public.credit_ledger_entries(id),
  ADD COLUMN IF NOT EXISTS payout_status text NOT NULL DEFAULT 'none'
    CHECK (payout_status IN ('none', 'pending_payout', 'paid'));

DO $$
BEGIN
  ALTER TABLE public.case_lessons
    ADD CONSTRAINT case_lessons_attendance_status_coherent
    CHECK (attendance IS NULL OR status IN ('done', 'no_show', 'cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_case_lessons_pending_payout
  ON public.case_lessons (tutor_id) WHERE payout_status = 'pending_payout';

CREATE OR REPLACE FUNCTION public.case_lessons_managed_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account uuid;
  v_late_billable boolean;
  v_entry public.credit_ledger_entries;
  v_settle text;
BEGIN
  SELECT c.credit_account_id,
         COALESCE((c.cancellation_policy ->> 'late_cancel_billable')::boolean, true)
    INTO v_account, v_late_billable
    FROM public.tutoring_cases c
    WHERE c.id = NEW.case_id AND c.managed;
  IF v_account IS NULL THEN
    RETURN NEW;
  END IF;

  -- Soft note gate, integrity half (the app shows the copy): one skip per case.
  IF TG_OP = 'UPDATE' AND NEW.note_skipped AND NOT OLD.note_skipped
     AND NEW.note_override_by IS NULL
     AND EXISTS (
       SELECT 1 FROM public.case_lessons
         WHERE case_id = NEW.case_id AND id <> NEW.id AND note_skipped
           AND note_override_by IS NULL
     ) THEN
    RAISE EXCEPTION 'NOTE_SKIP_USED' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.hold_entry_id IS NULL AND NEW.status IN ('planned', 'confirmed') THEN
    v_entry := public.post_credit_entry(
      v_account, 'HOLD', 1, 'hold:lesson:' || NEW.id::text,
      NEW.created_by, 'system'
    );
    NEW.hold_entry_id := v_entry.id;
  END IF;

  IF NEW.hold_entry_id IS NOT NULL AND NEW.settle_entry_id IS NULL THEN
    v_settle := CASE
      WHEN NEW.attendance IN ('present', 'late', 'left_early', 'absent_billable') THEN 'CONSUME'
      WHEN NEW.attendance = 'absent_excused' THEN 'RELEASE'
      WHEN NEW.status IN ('done', 'no_show') THEN 'CONSUME'
      WHEN NEW.status = 'cancelled' THEN 'RELEASE'
      WHEN NEW.status = 'late_cancel' THEN
        CASE WHEN v_late_billable THEN 'CONSUME' ELSE 'RELEASE' END
    END;
    IF v_settle IS NOT NULL THEN
      v_entry := public.post_credit_entry(
        v_account, v_settle, NULL, 'settle:lesson:' || NEW.id::text,
        NEW.attendance_marked_by, 'system', NEW.hold_entry_id
      );
      NEW.settle_entry_id := v_entry.id;
      IF v_settle = 'CONSUME' THEN
        NEW.payout_status := 'pending_payout';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_case_lessons_managed_ledger ON public.case_lessons;
CREATE TRIGGER trg_case_lessons_managed_ledger
  BEFORE INSERT OR UPDATE ON public.case_lessons
  FOR EACH ROW EXECUTE FUNCTION public.case_lessons_managed_ledger();

REVOKE ALL ON FUNCTION public.case_lessons_managed_ledger() FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE EXECUTE ON FUNCTION public.case_lessons_managed_ledger() FROM anon, authenticated;
  END IF;
END;
$$;
