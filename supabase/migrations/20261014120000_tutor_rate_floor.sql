-- Issue #319 — Lowest rate on the card, full rates on the profile.
--
-- Tutors quote one ONLINE base rate and one IN-PERSON base rate (each
-- optional, but at least one is required at the form layer), plus up to six
-- optional label+rate rows shown on the profile ONLY. The public card shows
-- the floor of the two base rates ("$200 up/hr"); extra rows must never
-- lower that floor, so they live in rate_rows and are excluded from the
-- min/max HKD snapshots the card price, price sort and price filter use.
--
-- Legacy rows (no base rates set) keep deriving snapshots from
-- hourly_rate / pricing_tiers exactly as before (migration
-- 20261005220000_add_multi_currency_core.sql).

ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS online_rate integer,
  ADD COLUMN IF NOT EXISTS inperson_rate integer,
  ADD COLUMN IF NOT EXISTS rate_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS travel_note text,
  ADD COLUMN IF NOT EXISTS rate_note text;

-- Whole-dollar rates in the product's 50-3000 band. Nullable so legacy rows
-- and unticked modes pass without a value.
ALTER TABLE public.tutors
  ADD CONSTRAINT tutors_online_rate_band_chk
    CHECK (online_rate IS NULL OR (online_rate >= 50 AND online_rate <= 3000)),
  ADD CONSTRAINT tutors_inperson_rate_band_chk
    CHECK (inperson_rate IS NULL OR (inperson_rate >= 50 AND inperson_rate <= 3000));

COMMENT ON COLUMN public.tutors.online_rate IS
  'Issue #319: online hourly base rate (whole dollars, native currency). One of online/inperson is required at the form layer.';
COMMENT ON COLUMN public.tutors.inperson_rate IS
  'Issue #319: in-person hourly base rate (whole dollars, native currency).';
COMMENT ON COLUMN public.tutors.rate_rows IS
  'Issue #319: profile-only extra rate rows [{label, rate}], max 6. Never affects the card floor or snapshots.';
COMMENT ON COLUMN public.tutors.travel_note IS
  'Issue #319: optional travel note (max 80 chars), shown under the in-person rate row. Contact-filtered.';
COMMENT ON COLUMN public.tutors.rate_note IS
  'Issue #319: optional "anything that changes this rate?" line (max 120 chars). Contact-filtered.';

-- Snapshot trigger: base rates (online/in-person) take precedence; extra
-- rows are deliberately excluded so they can never lower the card floor.
CREATE OR REPLACE FUNCTION public.tutors_normalize_hkd()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_rates numeric[];
  v_tiers numeric[];
BEGIN
  SELECT COALESCE(
    ARRAY(
      SELECT (tier->>'rate')::numeric
      FROM jsonb_array_elements(COALESCE(new.pricing_tiers, '[]'::jsonb)) AS tier
      WHERE jsonb_typeof(tier->'rate') = 'number'
    ),
    ARRAY[]::numeric[]
  ) INTO v_tiers;

  -- Issue #319: when either base rate is set, the floor is the lowest of the
  -- two base rates only. Extra rows are profile-only and never enter this.
  IF new.online_rate IS NOT NULL OR new.inperson_rate IS NOT NULL THEN
    v_rates := ARRAY(
      SELECT r
      FROM unnest(ARRAY[new.online_rate::numeric, new.inperson_rate::numeric]) AS r
      WHERE r IS NOT NULL
    );
  ELSE
    SELECT COALESCE(
      ARRAY(
        SELECT (tier->>'rate')::numeric
        FROM jsonb_array_elements(COALESCE(new.pricing_tiers, '[]'::jsonb)) AS tier
        WHERE jsonb_typeof(tier->'rate') = 'number'
      ),
      ARRAY[]::numeric[]
    ) INTO v_rates;
  END IF;

  -- Empty (or rate-less) tiers fall back to the flat hourly_rate.
  IF array_length(v_rates, 1) IS NULL THEN
    v_rates := ARRAY[new.hourly_rate::numeric];
  END IF;

  new.min_hourly_rate_hkd := public.normalize_to_hkd(
    (SELECT min(r) FROM unnest(v_rates) AS r), new.currency
  );
  new.max_hourly_rate_hkd := public.normalize_to_hkd(
    (SELECT max(r) FROM unnest(v_rates) AS r), new.currency
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_tutors_normalize_hkd ON public.tutors;
CREATE TRIGGER trg_tutors_normalize_hkd
  BEFORE INSERT OR UPDATE OF currency, hourly_rate, pricing_tiers,
    online_rate, inperson_rate, rate_rows, travel_note, rate_note
  ON public.tutors
  FOR EACH ROW EXECUTE FUNCTION public.tutors_normalize_hkd();

-- Backfill: recompute snapshots for rows that already carry base rates (a
-- re-run of this migration or manual writes before the trigger existed).
-- Direct computation, as in 20261005220000, so updated_at is untouched.
UPDATE public.tutors t
SET
  min_hourly_rate_hkd = public.normalize_to_hkd(
    CASE
      WHEN t.online_rate IS NOT NULL OR t.inperson_rate IS NOT NULL THEN
        (SELECT min(r) FROM unnest(ARRAY[t.online_rate::numeric, t.inperson_rate::numeric]) AS r WHERE r IS NOT NULL)
      ELSE COALESCE((
        SELECT min((tier->>'rate')::numeric)
        FROM jsonb_array_elements(COALESCE(t.pricing_tiers, '[]'::jsonb)) AS tier
        WHERE jsonb_typeof(tier->'rate') = 'number'
      ), t.hourly_rate::numeric)
    END,
    t.currency
  ),
  max_hourly_rate_hkd = public.normalize_to_hkd(
    CASE
      WHEN t.online_rate IS NOT NULL OR t.inperson_rate IS NOT NULL THEN
        (SELECT max(r) FROM unnest(ARRAY[t.online_rate::numeric, t.inperson_rate::numeric]) AS r WHERE r IS NOT NULL)
      ELSE COALESCE((
        SELECT max((tier->>'rate')::numeric)
        FROM jsonb_array_elements(COALESCE(t.pricing_tiers, '[]'::jsonb)) AS tier
        WHERE jsonb_typeof(tier->'rate') = 'number'
      ), t.hourly_rate::numeric)
    END,
    t.currency
  )
WHERE t.online_rate IS NOT NULL OR t.inperson_rate IS NOT NULL;
