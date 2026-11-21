-- Issue #768 — child sub-profile weekly HOURLY availability.
--
-- AC: "Students/Child sub-profiles can set availability, which remains private
-- by default and only shares with tutors on active case leads."
--
-- public.students is service-role only (RLS on, no anon/authenticated grants
-- from 20261030130000) and this migration does NOT change that: the column is
-- private on arrival (NULL = not set), and the only client-reachable writer is
-- the narrow SECURITY DEFINER RPC below, which proves ownership first. Nothing
-- here exposes the grid to tutors — the share path on active case leads reads
-- through service-role server functions owned elsewhere.
--
-- Shape matches tutors.availability_grid_hourly (#768 slice 1): 7 day keys
-- (mon..sun) × HKT / UTC+8 hours, each value a sorted array of Open START
-- hours (int 6..23). Missing day keys / empty arrays read as closed.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS availability_grid_hourly jsonb;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS availability_updated_at timestamptz;

COMMENT ON COLUMN public.students.availability_grid_hourly IS
  'Issue #768: child weekly HOURLY availability, PRIVATE by default (NULL = never set). Object keyed mon..sun, each a sorted array of Open START hours (int 6..23, HKT; cells cover 06:00-07:00 .. 23:00-24:00). Written only by update_my_child_availability(uuid, jsonb); shared with tutors only through service-role server functions on active case leads.';

COMMENT ON COLUMN public.students.availability_updated_at IS
  'Issue #768: stamped by update_my_child_availability when the parent/child saves availability_grid_hourly. NULL = availability never edited.';

-- ---------------------------------------------------------------------------
-- Self-serve write path for a child's hourly availability.
--
-- The caller must own the sub-profile row either as its linked parent
-- (students.parent_user_id) or as the claimed student (students.owner_user_id);
-- anything else raises NOT_YOUR_CHILD, which also covers a row id that does not
-- exist so the fn never leaks existence. Unlike the tutor RPC, malformed input
-- is NOT an error: the grid is sanitised to exactly mon..sun with sorted,
-- distinct whole hours 6..23 and everything else (unknown keys, strings,
-- fractions, out-of-range values, null/non-object input) is dropped.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_my_child_availability(
  _student_id uuid,
  _grid jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_student_id uuid;
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
  SELECT s.id
    INTO v_student_id
    FROM public.students s
   WHERE s.id = _student_id
     AND (s.owner_user_id = auth.uid() OR s.parent_user_id = auth.uid());

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'NOT_YOUR_CHILD';
  END IF;

  v_clean := '{}'::jsonb;
  FOREACH v_day IN ARRAY v_valid_days LOOP
    v_hours := ARRAY[]::int[];
    v_cells := _grid -> v_day;
    IF jsonb_typeof(v_cells) = 'array' THEN
      FOR v_cell IN SELECT value FROM jsonb_array_elements(v_cells) LOOP
        CONTINUE WHEN jsonb_typeof(v_cell) <> 'number';
        v_val := (v_cell #>> '{}')::numeric;
        CONTINUE WHEN v_val <> floor(v_val) OR v_val < 6 OR v_val > 23;
        v_hour := v_val::int;
        CONTINUE WHEN v_hour = ANY (v_hours);
        v_hours := array_append(v_hours, v_hour);
      END LOOP;
    END IF;
    -- Every day key is always emitted, empty array included, so the stored and
    -- returned shape is exactly the 7-key contract the client model expects.
    SELECT COALESCE(array_agg(x ORDER BY x), ARRAY[]::int[])
      INTO v_sorted
      FROM unnest(v_hours) AS x;
    v_clean := v_clean || jsonb_build_object(v_day, to_jsonb(v_sorted));
  END LOOP;

  UPDATE public.students
     SET availability_grid_hourly = v_clean,
         availability_updated_at = now(),
         updated_at = now()
   WHERE id = v_student_id
     AND (owner_user_id = auth.uid() OR parent_user_id = auth.uid());

  RETURN v_clean;
END;
$function$;

COMMENT ON FUNCTION public.update_my_child_availability(uuid, jsonb) IS
  'Issue #768: parent/claimed student saves a child sub-profile''s private hourly availability. Raises NOT_YOUR_CHILD unless students.owner_user_id or students.parent_user_id = auth.uid(); sanitises the grid to mon..sun × sorted distinct ints 6..23 and returns the sanitised object.';

REVOKE ALL ON FUNCTION public.update_my_child_availability(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_child_availability(uuid, jsonb) TO authenticated;
