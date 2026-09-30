-- Issue #103: tutor self-serve capacity toggle & macro availability windows.
--
-- Three new self-serve columns on tutors (tutors update them directly via the
-- update_my_capacity RPC — no admin review):
--   remaining_student_slots  integer, default 2, clamped 0-99 by the RPC
--   is_accepting_students    boolean, default true ("Paused" when false)
--   preferred_time_windows   text[] of the four macro buckets below
--
-- Locked fields (academic_credentials, ib_score, transcripts, hourly_rate,
-- subjects_taught) keep requiring admin review — this RPC never touches them.

ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS remaining_student_slots INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS is_accepting_students BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS preferred_time_windows TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.tutors.remaining_student_slots IS
  'Issue #103: self-serve open-slot count (0-99). 0 renders the Fully Booked / waitlist state.';
COMMENT ON COLUMN public.tutors.is_accepting_students IS
  'Issue #103: self-serve Accepting New Students toggle. False pauses new inquiries.';
COMMENT ON COLUMN public.tutors.preferred_time_windows IS
  'Issue #103: macro availability buckets: weekday_afternoon, weekday_evening, weekend_morning, weekend_afternoon.';

CREATE INDEX IF NOT EXISTS tutors_accepting_students_idx
  ON public.tutors (is_accepting_students)
  WHERE is_accepting_students = false;

-- Self-serve write path, mirroring update_my_availability (issue #106):
-- SECURITY DEFINER keeps the write scoped to these three columns on the
-- signed-in tutor's own card. Locked/verified fields are unreachable here, so
-- an unverified price or grade change is impossible by construction.
CREATE OR REPLACE FUNCTION public.update_my_capacity(
  _remaining_student_slots integer,
  _is_accepting_students boolean,
  _preferred_time_windows text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tutor_id uuid;
BEGIN
  SELECT id INTO _tutor_id FROM public.tutors WHERE user_id = auth.uid() LIMIT 1;
  IF _tutor_id IS NULL THEN
    RAISE EXCEPTION 'No tutor card is linked to this account';
  END IF;

  IF _remaining_student_slots < 0 OR _remaining_student_slots > 99 THEN
    RAISE EXCEPTION 'Open slots must be between 0 and 99';
  END IF;

  UPDATE public.tutors
  SET remaining_student_slots = _remaining_student_slots,
      is_accepting_students = _is_accepting_students,
      preferred_time_windows = (
        SELECT COALESCE(array_agg(w), '{}')
        FROM unnest(_preferred_time_windows) AS w
        WHERE w IN (
          'weekday_afternoon',
          'weekday_evening',
          'weekend_morning',
          'weekend_afternoon'
        )
      ),
      updated_at = now()
  WHERE id = _tutor_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_my_capacity(integer, boolean, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_capacity(integer, boolean, text[]) TO authenticated;
