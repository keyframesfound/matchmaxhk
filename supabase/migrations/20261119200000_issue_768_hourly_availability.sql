-- Issue #768 — hourly availability for the public tutor card.
--
-- Adds a 24-hour resolution availability model next to the existing 3-hour
-- self-serve grid (public.tutors.availability_grid, 20261001200000):
--
--   availability_hours               jsonb, object keyed mon..sun, each an array
--                                    of exactly 24 booleans, index 0..23 = the
--                                    tutor's local hour (Asia/Hong_Kong).
--   availability_hours_reviewed_at   timestamptz, set when the tutor confirms
--                                    the hourly view in the dashboard.
--
-- The grid stays the write surface for the coarse view; this column is the
-- finer model. Backfill runs ONCE per row (see the idempotency note below).
--
-- Nothing here reads or writes public.case_lessons from the write path:
-- occupancy is always derived at read time in get_tutor_public_availability.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS availability_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS availability_hours_reviewed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.tutors.availability_hours IS
  'Issue #768: hourly availability. Object keyed mon..sun, each an array of exactly 24 booleans; index 0..23 is the HKT local hour. Written by update_my_availability_hours (self-serve) and backfilled once from availability_grid. ''{}''::jsonb means "never backfilled", which is why the backfill below is guarded on that value.';
COMMENT ON COLUMN public.tutors.availability_hours_reviewed_at IS
  'Issue #768: set when the tutor confirms the hourly availability view. NULL = never confirmed; the backfilled grid values are a starting point, not a review.';

-- ---------------------------------------------------------------------------
-- Backfill from the 3-hour grid.
--
-- availability_grid shape (20261001200000_add_availability_grid.sql:7-11):
--   { "mon": ["u","u","p","a","a","u"], ... }
-- 6 fixed 3-hour bands: 06-09, 09-12, 12-15, 15-18, 18-21, 21-24 → band index
--   (hour - 6) / 3   for hour 6..23; hours 0..5 have no grid coverage.
-- Cell code → the three hours in that band:
--   'a' available   → true
--   'p' partial     → false (never invent hours inside a Partial block)
--   'u' unavailable → false
--   missing / short / corrupt / non-array → false
--
-- IDEMPOTENCY: the WHERE guard is `availability_hours = '{}'::jsonb`, so a
-- re-run touches no row that already carries a written value. A tutor who has
-- since changed their hours keeps them — the backfill cannot reopen (or close)
-- an hour a tutor set after the first run. Every written value has all 7 day
-- keys and exactly 24 booleans per day, so the guard is only ever true for
-- rows this migration has not yet filled.
-- ---------------------------------------------------------------------------
UPDATE public.tutors AS t
SET availability_hours = (
  SELECT jsonb_object_agg(days.day_key, days.hours ORDER BY days.dow)
  FROM (
    SELECT
      day_key,
      dow,
      (
        SELECT jsonb_agg(
                 CASE
                   WHEN hour >= 6 THEN coalesce(
                     ((t.availability_grid -> day_key) ->> ((hour - 6) / 3)) = 'a',
                     false
                   )
                   ELSE false
                 END
                 ORDER BY hour
               )
        FROM generate_series(0, 23) AS gs(hour)
      ) AS hours
    FROM (VALUES
      ('mon', 1), ('tue', 2), ('wed', 3), ('thu', 4),
      ('fri', 5), ('sat', 6), ('sun', 7)
    ) AS days(day_key, dow)
  ) AS days
)
WHERE t.availability_hours = '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- update_my_availability_hours: self-serve write path.
--
-- Mirrors update_my_availability_grid (20261001200000_add_availability_grid.sql:24-95):
-- SECURITY DEFINER, and the write is pinned to the signed-in tutor's own card
-- via `id` looked up by `user_id = auth.uid()`. A tutor can never address
-- another tutor's row.
--
-- Validation is strict — the payload must be an object with exactly the 7 day
-- keys, each an array of exactly 24 entries, each entry a boolean or the
-- numbers 0/1. Values are normalised to real booleans before the write. Any
-- other shape raises instead of storing garbage.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_my_availability_hours(
  _hours jsonb,
  _mark_reviewed boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tutor_id uuid;
  _valid_days text[] := ARRAY['mon','tue','wed','thu','fri','sat','sun'];
  _day text;
  _cells jsonb;
  _entry jsonb;
  _normalised jsonb := '{}'::jsonb;
  _day_hours jsonb;
  _value boolean;
  _i int;
BEGIN
  IF _hours IS NULL THEN
    RAISE EXCEPTION 'availability hours must be a JSON object';
  END IF;
  IF jsonb_typeof(_hours) <> 'object' THEN
    RAISE EXCEPTION 'availability hours must be a JSON object';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(_hours) AS k(day)
    WHERE NOT (k.day = ANY(_valid_days))
  ) THEN
    RAISE EXCEPTION 'availability hours have an unknown day key';
  END IF;

  FOREACH _day IN ARRAY _valid_days LOOP
    _cells := _hours -> _day;
    IF _cells IS NULL OR jsonb_typeof(_cells) = 'null' THEN
      RAISE EXCEPTION 'availability hours are missing day %', _day;
    END IF;
    IF jsonb_typeof(_cells) <> 'array' THEN
      RAISE EXCEPTION 'availability hours for day % must be an array', _day;
    END IF;
    IF jsonb_array_length(_cells) <> 24 THEN
      RAISE EXCEPTION 'availability hours for day % must have exactly 24 entries', _day;
    END IF;

    _day_hours := '[]'::jsonb;
    FOR _i IN 0..23 LOOP
      _entry := _cells -> _i;
      IF _entry = 'true'::jsonb OR _entry = '1'::jsonb THEN
        _value := true;
      ELSIF _entry = 'false'::jsonb OR _entry = '0'::jsonb THEN
        _value := false;
      ELSE
        RAISE EXCEPTION 'availability hours for day % hour % must be a boolean', _day, _i;
      END IF;
      _day_hours := _day_hours || to_jsonb(_value);
    END LOOP;

    _normalised := _normalised || jsonb_build_object(_day, _day_hours);
  END LOOP;

  SELECT id INTO _tutor_id FROM public.tutors WHERE user_id = auth.uid() LIMIT 1;
  IF _tutor_id IS NULL THEN
    RAISE EXCEPTION 'No tutor card is linked to this account';
  END IF;

  IF _mark_reviewed THEN
    UPDATE public.tutors
    SET availability_hours = _normalised,
        availability_hours_reviewed_at = now(),
        updated_at = now()
    WHERE id = _tutor_id;
  ELSE
    -- Leaving the timestamp untouched keeps "confirmed at" meaningful across
    -- later edits that the tutor has not re-confirmed.
    UPDATE public.tutors
    SET availability_hours = _normalised,
        updated_at = now()
    WHERE id = _tutor_id;
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.update_my_availability_hours(jsonb, boolean) IS
  'Issue #768: self-serve hourly availability write for the signed-in tutor. Validates 7 day keys x 24 boolean entries (0/1 coerced) and never touches another tutor row or case_lessons. _mark_reviewed = true stamps availability_hours_reviewed_at.';

REVOKE ALL ON FUNCTION public.update_my_availability_hours(jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_availability_hours(jsonb, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- get_tutor_public_availability: public read model for the card / profile.
--
-- Returns ONLY (tutor_id, day_of_week, hour, state). No display names, no case
-- ids, no subject/level, no counts, no earnings — nothing that identifies a
-- student or a booking.
--
-- day_of_week is ISO-8601: 1 = Monday .. 7 = Sunday, matching the mon..sun keys
-- of availability_hours (mon=1, tue=2, ... sun=7).
--
-- 'open'     lies in availability_hours and is marked true.
-- 'occupied' a live lesson for that tutor covers the hour.
--            Source of truth: public.case_lessons (20261017150000_sor_case_core.sql:73),
--            columns `tutor_id` (:77), `starts_at timestamptz` (:78),
--            `duration_min integer` (:79), `status text` (:81-82, allowed values
--            planned/confirmed/done/no_show/cancelled/late_cancel). Only
--            status = 'confirmed' with starts_at >= now() counts, exactly as
--            specified for this surface.
--            A lesson spans every hour it covers: 10:00 + 90 min occupies hours
--            10 and 11. The hour/day of each covered slot is derived from the
--            shifted timestamp at Asia/Hong_Kong, so a lesson crossing midnight
--            lands on the correct weekday instead of hour 24/25.
--
-- One row per (tutor, day, hour): an hour that is both open and occupied emits
-- a single 'occupied' row. Unknown tutor ids, empty input, and NULL input all
-- return zero rows.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_tutor_public_availability(
  p_tutor_ids uuid[]
)
RETURNS TABLE (
  tutor_id uuid,
  day_of_week int,
  hour int,
  state text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH requested AS (
    SELECT t.id, t.availability_hours
    FROM unnest(coalesce(p_tutor_ids, '{}'::uuid[])) AS x(id)
    JOIN public.tutors t ON t.id = x.id
  ),
  days AS (
    SELECT d.day_key, d.dow
    FROM (VALUES
      ('mon', 1), ('tue', 2), ('wed', 3), ('thu', 4),
      ('fri', 5), ('sat', 6), ('sun', 7)
    ) AS d(day_key, dow)
  ),
  open_hours AS (
    SELECT r.id AS tutor_id, d.dow AS day_of_week, h.hour
    FROM requested r
    CROSS JOIN days d
    CROSS JOIN generate_series(0, 23) AS h(hour)
    -- Entries are written as real booleans; '1' is accepted defensively for a
    -- hand-written service-role value so it does not silently read as closed.
    WHERE (r.availability_hours -> d.day_key ->> h.hour) IN ('true', '1')
  ),
  occupied_hours AS (
    SELECT DISTINCT
      l.tutor_id,
      extract(isodow FROM ((l.starts_at + make_interval(mins => off * 60)) AT TIME ZONE 'Asia/Hong_Kong'))::int AS day_of_week,
      extract(hour FROM ((l.starts_at + make_interval(mins => off * 60)) AT TIME ZONE 'Asia/Hong_Kong'))::int AS hour
    FROM public.case_lessons l
    JOIN requested r ON r.id = l.tutor_id
    CROSS JOIN LATERAL generate_series(
      0,
      greatest(ceil(l.duration_min / 60.0)::int - 1, 0)
    ) AS off
    WHERE l.status = 'confirmed'
      AND l.starts_at >= now()
  )
  SELECT o.tutor_id, o.day_of_week, o.hour, 'occupied'::text AS state
  FROM occupied_hours o
  UNION ALL
  SELECT oh.tutor_id, oh.day_of_week, oh.hour, 'open'::text AS state
  FROM open_hours oh
  WHERE NOT EXISTS (
    SELECT 1
    FROM occupied_hours o
    WHERE o.tutor_id = oh.tutor_id
      AND o.day_of_week = oh.day_of_week
      AND o.hour = oh.hour
  )
  ORDER BY 1, 2, 3;
$function$;

COMMENT ON FUNCTION public.get_tutor_public_availability(uuid[]) IS
  'Issue #768: public 24h availability for tutor cards. day_of_week is ISO (1=Mon..7=Sun), hour is 0..23 HKT. state is ''open'' (from availability_hours) or ''occupied'' (derived from confirmed future case_lessons; an overlapping hour reports only occupied). Unknown/empty/NULL ids return zero rows.';

REVOKE ALL ON FUNCTION public.get_tutor_public_availability(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tutor_public_availability(uuid[]) TO anon, authenticated;
