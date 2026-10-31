-- Issue #461 Phase A (3b): tutor-side tuition tracking, idempotent lesson
-- writes and soft-void on case_lessons; tuition tracking on #387 session logs.
--
--   tuition_status     NULL = not tracked (counts as collected), 'unpaid' =
--                      the family still owes the tutor this lesson's tuition,
--                      'paid' = the tutor marked it collected. Tuition is
--                      tutor ↔ family; MatchMax never holds it.
--   client_request_id  UI-generated UUID so a double-submit creates one row.
--   status 'voided'    soft-void by staff: the row stays for audit but drops
--                      out of fees, hours, earnings and the double-book guard.
-- Staff-only columns: no new client grants (server functions use service role).

ALTER TABLE public.case_lessons
  ADD COLUMN IF NOT EXISTS tuition_status text
    CHECK (tuition_status IS NULL OR tuition_status IN ('unpaid', 'paid')),
  ADD COLUMN IF NOT EXISTS tuition_status_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_request_id uuid,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid,
  ADD COLUMN IF NOT EXISTS void_reason text
    CHECK (void_reason IS NULL OR char_length(void_reason) BETWEEN 3 AND 500);

CREATE UNIQUE INDEX IF NOT EXISTS uq_case_lessons_client_request_id
  ON public.case_lessons (client_request_id)
  WHERE client_request_id IS NOT NULL;

-- Inline CHECK from 20261017150000_sor_case_core.sql, plus 'voided'.
ALTER TABLE public.case_lessons DROP CONSTRAINT IF EXISTS case_lessons_status_check;
ALTER TABLE public.case_lessons
  ADD CONSTRAINT case_lessons_status_check
  CHECK (status IN ('planned', 'confirmed', 'done', 'no_show', 'cancelled', 'late_cancel', 'voided'));

-- #533 coherence check, plus 'voided' so an attended lesson can be voided
-- without erasing its attendance record.
ALTER TABLE public.case_lessons DROP CONSTRAINT IF EXISTS case_lessons_attendance_status_coherent;
ALTER TABLE public.case_lessons
  ADD CONSTRAINT case_lessons_attendance_status_coherent
  CHECK (attendance IS NULL OR status IN ('done', 'no_show', 'cancelled', 'voided'));

ALTER TABLE public.case_lessons DROP CONSTRAINT IF EXISTS case_lessons_void_fields_coherent;
ALTER TABLE public.case_lessons
  ADD CONSTRAINT case_lessons_void_fields_coherent
  CHECK ((status = 'voided') = (voided_at IS NOT NULL));

ALTER TABLE public.tutor_session_logs
  ADD COLUMN IF NOT EXISTS tuition_status text
    CHECK (tuition_status IS NULL OR tuition_status IN ('unpaid', 'paid')),
  ADD COLUMN IF NOT EXISTS tuition_status_at timestamptz;

COMMENT ON COLUMN public.case_lessons.tuition_status IS
  '#461: NULL = not tracked, unpaid = family owes the tutor, paid = tutor marked collected. Tutor-set only.';
COMMENT ON COLUMN public.case_lessons.client_request_id IS
  '#461: idempotency key from the UI; one row per key.';
COMMENT ON COLUMN public.case_lessons.void_reason IS
  '#461: staff soft-void reason. Voided rows are never deleted.';
COMMENT ON COLUMN public.tutor_session_logs.tuition_status IS
  '#461: NULL = not tracked, unpaid = family owes the tutor, paid = tutor marked collected.';
