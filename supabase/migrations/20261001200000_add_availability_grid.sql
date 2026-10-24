-- Issue #116: weekly availability grid (TutorCircle-style) on tutor profiles.
--
-- Self-serve JSONB column on tutors: a 7-day × 6-slot matrix of cell states.
-- Tutors edit it in Dashboard → Availability (below the existing capacity
-- controls) via the update_my_availability_grid RPC — no admin review.
--
-- Shape (validated by the RPC; missing keys read as "unavailable"):
--   { "mon": ["u","u","p","a","a","u"], "tue": [...], ... "sun": [...] }
-- Cell codes: "a" available, "p" partial (some times workable), "u" unavailable.
-- Slots are fixed 3-hour bands, labelled AM/PM on the client:
--   06:00-09:00, 09:00-12:00, 12:00-15:00, 15:00-18:00, 18:00-21:00, 21:00-24:00
-- Days are mon..sun (client maps to localized labels).

ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS availability_grid JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.tutors.availability_grid IS
  'Issue #116: self-serve weekly availability grid. Object keyed mon..sun, each an array of 6 cell codes ("a" available, "p" partial, "u" unavailable) for the fixed 3-hour bands 06-09, 09-12, 12-15, 15-18, 18-21, 21-24. Empty object = not set (grid hidden on the public profile).';

-- Self-serve write path, mirroring update_my_capacity: SECURITY DEFINER keeps
-- the write scoped to this one column on the signed-in tutor's own card.
-- Validates structure strictly: 7 known day keys, each exactly 6 codes from
-- a/p/u. Accepts {} to clear the grid.
CREATE OR REPLACE FUNCTION public.update_my_availability_grid(
  _grid jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tutor_id uuid;
  _day text;
  _cells jsonb;
  _i int;
  _code text;
  _valid_days text[] := ARRAY['mon','tue','wed','thu','fri','sat','sun'];
BEGIN
  IF _grid IS NULL THEN
    RAISE EXCEPTION 'availability grid must be a JSON object';
  END IF;
  IF jsonb_typeof(_grid) <> 'object' THEN
    RAISE EXCEPTION 'availability grid must be a JSON object';
  END IF;

  -- Empty object clears the grid.
  IF _grid = '{}'::jsonb THEN
    SELECT id INTO _tutor_id FROM public.tutors WHERE user_id = auth.uid() LIMIT 1;
    IF _tutor_id IS NULL THEN
      RAISE EXCEPTION 'No tutor card is linked to this account';
    END IF;
    UPDATE public.tutors SET availability_grid = '{}'::jsonb, updated_at = now()
    WHERE id = _tutor_id;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(_grid) AS k(day)
    WHERE NOT (k.day = ANY(_valid_days))
  ) THEN
    RAISE EXCEPTION 'availability grid has an unknown day key';
  END IF;

  FOREACH _day IN ARRAY _valid_days LOOP
    _cells := _grid -> _day;
    IF _cells IS NULL OR jsonb_typeof(_cells) = 'null' THEN
      RAISE EXCEPTION 'availability grid is missing day %', _day;
    END IF;
    IF jsonb_typeof(_cells) <> 'array' THEN
      RAISE EXCEPTION 'availability grid day % must be an array', _day;
    END IF;
    IF jsonb_array_length(_cells) <> 6 THEN
      RAISE EXCEPTION 'availability grid day % must have exactly 6 cells', _day;
    END IF;
    FOR _i IN 0..5 LOOP
      _code := _cells ->> _i;
      IF _code IS NULL OR _code NOT IN ('a', 'p', 'u') THEN
        RAISE EXCEPTION 'availability grid day % cell % must be "a", "p" or "u"', _day, _i;
      END IF;
    END LOOP;
  END LOOP;

  SELECT id INTO _tutor_id FROM public.tutors WHERE user_id = auth.uid() LIMIT 1;
  IF _tutor_id IS NULL THEN
    RAISE EXCEPTION 'No tutor card is linked to this account';
  END IF;

  UPDATE public.tutors SET availability_grid = _grid, updated_at = now()
  WHERE id = _tutor_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_my_availability_grid(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_availability_grid(jsonb) TO authenticated;
