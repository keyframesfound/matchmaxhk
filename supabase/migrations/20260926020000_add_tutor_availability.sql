-- Issue #106: tutor earliest start date & automated pre-booking visibility.
-- start_immediately / earliest_start_date drive a derived availability status:
--   immediate         -> start_immediately, or start date within 7 days
--   pre_booking       -> start date 8-30 days out (amber badge + pre-book CTA)
--   future_scheduled  -> start date >30 days out (hidden from public browse)
-- The status is derived at read time in queries.ts, so no stored readiness
-- column or cron transition is needed; profiles move between states on their
-- own as today's date advances.

ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS start_immediately BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS earliest_start_date DATE;

COMMENT ON COLUMN public.tutors.start_immediately IS
  'True when the tutor can take students right away; false when earliest_start_date governs availability (issue #106).';
COMMENT ON COLUMN public.tutors.earliest_start_date IS
  'Self-serve availability anchor: pre-booking badge 8-30 days out, hidden from public browse beyond 30 days (issue #106).';

-- Tutors update their own availability without an admin review cycle. SECURITY
-- DEFINER keeps the write scoped to these two columns on their linked card;
-- admins keep full-row UPDATE via the existing policies.
CREATE OR REPLACE FUNCTION public.update_my_availability(
  _start_immediately boolean,
  _earliest_start_date date DEFAULT NULL
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

  IF NOT _start_immediately THEN
    IF _earliest_start_date IS NULL THEN
      RAISE EXCEPTION 'Pick the date you can start taking students';
    END IF;
    IF _earliest_start_date < CURRENT_DATE THEN
      RAISE EXCEPTION 'The start date must be today or later';
    END IF;
  END IF;

  UPDATE public.tutors
  SET start_immediately = _start_immediately,
      earliest_start_date = CASE WHEN _start_immediately THEN NULL ELSE _earliest_start_date END,
      updated_at = now()
  WHERE id = _tutor_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_my_availability(boolean, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_availability(boolean, date) TO authenticated;
