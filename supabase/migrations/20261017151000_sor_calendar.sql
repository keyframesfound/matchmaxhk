-- Issue #204: Calendar on the case — tutor-published weekly availability and
-- blackout dates. Slots are derived (60 min, 14 days ahead) in the app layer
-- (src/features/cases/slot.ts, vitest-covered); these tables are the source of
-- truth. Confirmed lessons are independent rows on case_lessons, so editing
-- weekly hours never deletes a confirmed lesson.
-- RLS-deny like the rest of the SoR batch; access via service-role server fns.

CREATE TABLE IF NOT EXISTS public.tutor_weekly_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES public.tutors(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0 = Monday
  start_minute integer NOT NULL CHECK (start_minute BETWEEN 0 AND 1440),
  end_minute integer NOT NULL CHECK (end_minute BETWEEN 0 AND 1440),
  station text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (start_minute < end_minute)
);
CREATE INDEX IF NOT EXISTS idx_weekly_windows_tutor ON public.tutor_weekly_windows (tutor_id, weekday);
COMMENT ON TABLE public.tutor_weekly_windows IS
  '#204: tutor weekly availability windows in HKT minutes-from-midnight. Editing these never touches confirmed lessons.';

CREATE TABLE IF NOT EXISTS public.tutor_blackout_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES public.tutors(id) ON DELETE CASCADE,
  blackout_date date NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tutor_id, blackout_date)
);
COMMENT ON TABLE public.tutor_blackout_dates IS
  '#204: dates the tutor is fully unavailable; slots falling on them are not offered.';

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tutor_weekly_windows', 'tutor_blackout_dates'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
