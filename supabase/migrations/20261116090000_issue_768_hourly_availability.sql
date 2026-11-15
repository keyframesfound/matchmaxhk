-- Issue #768 (slice 1) — weekly HOURLY availability grid on tutors.
--
-- Upgrades the live 3-hour grid (tutors.availability_grid, PR #168 — kept
-- UNTOUCHED as the fallback read until cutover) to a weekly hourly Open/closed
-- calendar: 7 day keys (mon..sun) × HKT / UTC+8 hours 06:00–24:00, stored as
-- the sorted array of Open START hours per day. Only two public states exist
-- on the new grid — Open (可約) and Occupied (已佔用); Occupied is derived at
-- READ time from confirmed lessons, never stored here.
--
-- Shape (validated by the RPC below):
--   { "mon": [16,17,18], "tue": [], ... "sun": [] }
-- Missing day keys / empty arrays read as closed. {} = no Open hours.
--
-- One-time auto-map of the existing 3-hour cells (CEO lock 2026-11-13):
--   a (Generally available / 可補) -> all three hourly cells in that block Open
--   u (Not offered / 不可補)       -> stays closed
--   p (Partially available / 部分時段可) -> left UNSET — do not invent hours
-- inside a Partial block, and do not keep Partial as a public third state.

ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS availability_grid_hourly JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS availability_grid_hourly_reviewed_at timestamptz;

COMMENT ON COLUMN public.tutors.availability_grid_hourly IS
  'Issue #768: self-serve weekly HOURLY availability. Object keyed mon..sun, each a sorted array of Open START hours (int 6..23, HKT; cells cover 06:00-07:00 .. 23:00-24:00). Missing/empty = closed. {} = no Open hours (public profile shows the empty state). Occupied overrides are derived on read from confirmed lessons, never stored.';

COMMENT ON COLUMN public.tutors.availability_grid_hourly_reviewed_at IS
  'Issue #768: stamped when the tutor saves the hourly grid or dismisses the one-time "Review your hourly calendar" prompt after the 3-hour auto-map.';

-- ---------------------------------------------------------------------------
-- One-time auto-map of existing 3-hour cells (CEO lock 2026-11-13).
-- Runs only for rows whose hourly column is still the default '{}', so a
-- tutor who later INTENTIONALLY saves an empty hourly grid is not re-mapped
-- by a hypothetical re-apply of the same stamped migration.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_tutor record;
  v_day text;
  v_i int;
  v_code text;
  v_hours int[];
  v_payload jsonb;
  v_days constant text[] := ARRAY['mon','tue','wed','thu','fri','sat','sun'];
BEGIN
  FOR v_tutor IN
    SELECT id, availability_grid FROM public.tutors
    WHERE availability_grid_hourly = '{}'::jsonb
  LOOP
    v_payload := '{}'::jsonb;
    FOREACH v_day IN ARRAY v_days LOOP
      v_hours := ARRAY[]::int[];
      IF jsonb_typeof(v_tutor.availability_grid -> v_day) = 'array' THEN
        FOR v_i IN 0..5 LOOP
          v_code := v_tutor.availability_grid -> v_day ->> v_i;
          -- 'a' opens all three hourly cells in the 3-hour block; 'p' and 'u'
          -- stay closed (Partial hours are never invented).
          IF v_code = 'a' THEN
            v_hours := array_append(v_hours, 6 + 3 * v_i);
            v_hours := array_append(v_hours, 7 + 3 * v_i);
            v_hours := array_append(v_hours, 8 + 3 * v_i);
          END IF;
        END LOOP;
      END IF;
      IF array_length(v_hours, 1) > 0 THEN
        v_payload := jsonb_set(v_payload, ARRAY[v_day], to_jsonb(v_hours));
      END IF;
    END LOOP;
    UPDATE public.tutors SET availability_grid_hourly = v_payload WHERE id = v_tutor.id;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Self-serve write path for the hourly grid, mirroring
-- update_my_availability_grid (PR #168): SECURITY DEFINER keeps the write
-- scoped to this one column on the signed-in tutor's own card. Validates
-- structure strictly: known day keys only, each value an array of whole hours
-- 6..23 (duplicates removed, order normalised). Accepts {} to clear.
-- Every save also stamps availability_grid_hourly_reviewed_at, which retires
-- the one-time "Review your hourly calendar" prompt.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_my_availability_grid_hourly(
  _grid jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tutor_id uuid;
  v_day text;
  v_cells jsonb;
  v_cell jsonb;
  v_val numeric;
  v_hour int;
  v_hours int[];
  v_sorted int[];
  v_clean jsonb;
  v_valid_days constant text[] := ARRAY['mon','tue','wed','thu','fri','sat','sun'];
BEGIN
  IF _grid IS NULL OR jsonb_typeof(_grid) <> 'object' THEN
    RAISE EXCEPTION 'availability grid must be a JSON object';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(_grid) AS k(day)
    WHERE NOT (k.day = ANY(v_valid_days))
  ) THEN
    RAISE EXCEPTION 'availability grid has an unknown day key';
  END IF;

  v_clean := '{}'::jsonb;
  FOREACH v_day IN ARRAY v_valid_days LOOP
    v_cells := _grid -> v_day;
    CONTINUE WHEN v_cells IS NULL OR jsonb_typeof(v_cells) = 'null';
    IF jsonb_typeof(v_cells) <> 'array' THEN
      RAISE EXCEPTION 'availability grid day % must be an array of hours', v_day;
    END IF;
    v_hours := ARRAY[]::int[];
    FOR v_cell IN SELECT value FROM jsonb_array_elements(v_cells) LOOP
      IF jsonb_typeof(v_cell) <> 'number' THEN
        RAISE EXCEPTION 'availability grid day % hours must be whole numbers 6..23', v_day;
      END IF;
      v_val := (v_cell #>> '{}')::numeric;
      IF v_val <> floor(v_val) OR v_val < 6 OR v_val > 23 THEN
        RAISE EXCEPTION 'availability grid day % hours must be whole numbers 6..23', v_day;
      END IF;
      v_hour := v_val::int;
      IF NOT (v_hour = ANY(v_hours)) THEN
        v_hours := array_append(v_hours, v_hour);
      END IF;
    END LOOP;
    IF array_length(v_hours, 1) > 0 THEN
      SELECT array_agg(x ORDER BY x) INTO v_sorted FROM unnest(v_hours) AS x;
      v_clean := jsonb_set(v_clean, ARRAY[v_day], to_jsonb(v_sorted));
    END IF;
  END LOOP;

  SELECT id INTO v_tutor_id FROM public.tutors WHERE user_id = auth.uid() LIMIT 1;
  IF v_tutor_id IS NULL THEN
    RAISE EXCEPTION 'No tutor card is linked to this account';
  END IF;

  UPDATE public.tutors
  SET availability_grid_hourly = v_clean,
      availability_grid_hourly_reviewed_at = now(),
      updated_at = now()
  WHERE id = v_tutor_id;
END;
$function$;

-- One-time prompt dismissal WITHOUT a save: the tutor reviewed the auto-mapped
-- hours and accepted them as-is.
CREATE OR REPLACE FUNCTION public.confirm_my_availability_hourly_reviewed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tutor_id uuid;
BEGIN
  SELECT id INTO v_tutor_id FROM public.tutors WHERE user_id = auth.uid() LIMIT 1;
  IF v_tutor_id IS NULL THEN
    RAISE EXCEPTION 'No tutor card is linked to this account';
  END IF;
  UPDATE public.tutors
  SET availability_grid_hourly_reviewed_at = now(), updated_at = now()
  WHERE id = v_tutor_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_my_availability_grid_hourly(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_my_availability_hourly_reviewed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_availability_grid_hourly(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_my_availability_hourly_reviewed() TO authenticated;
