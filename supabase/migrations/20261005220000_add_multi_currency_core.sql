-- Multi-currency core (issue #112).
--
-- Every stored price keeps its native currency (tutors.hourly_rate /
-- pricing_tiers and tutoring_cases.budget_min / budget_max) plus an
-- HKD-normalized snapshot maintained by BEFORE triggers, so sorting,
-- filtering, matching and reporting stay currency-consistent no matter what
-- the tutor or parent entered. Daily FX rates live in exchange_rates as
-- HKD -> X rows, refreshed by the app's FX engine (Frankfurter / ECB
-- reference rates) and seeded here with current approximate values so
-- normalization works before the first fetch.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Supported currencies + rate storage
-- ---------------------------------------------------------------------------

CREATE TYPE public.supported_currency AS ENUM
  ('HKD', 'CNY', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'SGD');

CREATE TABLE IF NOT EXISTS public.exchange_rates (
  source_currency supported_currency NOT NULL,
  target_currency supported_currency NOT NULL,
  rate numeric(16,8) NOT NULL CHECK (rate > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_currency, target_currency)
);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exchange_rates_public_read ON public.exchange_rates;
CREATE POLICY exchange_rates_public_read
  ON public.exchange_rates FOR SELECT
  USING (true);
-- No INSERT/UPDATE/DELETE policies: only the service role (the app's FX
-- engine) may write rates.

COMMENT ON TABLE public.exchange_rates IS
  'Daily FX rates relative to the base currency: one row per source->target pair; the base HKD row set is written by the app''s daily FX engine.';
COMMENT ON COLUMN public.exchange_rates.rate IS
  'Units of target_currency per one unit of source_currency.';

-- Initial estimates (October 2026); the daily engine refresh overwrites them.
INSERT INTO public.exchange_rates (source_currency, target_currency, rate) VALUES
  ('HKD', 'HKD', 1.0),
  ('HKD', 'CNY', 0.912),
  ('HKD', 'USD', 0.1285),
  ('HKD', 'GBP', 0.0965),
  ('HKD', 'EUR', 0.1105),
  ('HKD', 'CAD', 0.1790),
  ('HKD', 'AUD', 0.1940),
  ('HKD', 'SGD', 0.1660)
ON CONFLICT (source_currency, target_currency) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Conversion helpers
-- ---------------------------------------------------------------------------

-- Multiplier converting `cur` amounts into HKD (1 for the base itself, NULL
-- when no rate row exists yet so callers can fall back to native values).
CREATE OR REPLACE FUNCTION public.fx_rate_to_hkd(cur supported_currency)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN cur = 'HKD'::supported_currency THEN 1::numeric
    ELSE (
      SELECT (1 / er.rate)
      FROM public.exchange_rates er
      WHERE er.source_currency = 'HKD'::supported_currency
        AND er.target_currency = cur
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_to_hkd(amount numeric, cur supported_currency)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT round(amount * public.fx_rate_to_hkd(cur), 2);
$$;

-- ---------------------------------------------------------------------------
-- 3. Tutors: native pricing (currency + pricing_tiers / hourly_rate) with an
--    HKD-normalized min/max maintained on write
-- ---------------------------------------------------------------------------

ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS currency supported_currency NOT NULL DEFAULT 'HKD',
  ADD COLUMN IF NOT EXISTS min_hourly_rate_hkd numeric(10,2),
  ADD COLUMN IF NOT EXISTS max_hourly_rate_hkd numeric(10,2);

CREATE INDEX IF NOT EXISTS idx_tutors_min_hourly_rate_hkd
  ON public.tutors (min_hourly_rate_hkd);

CREATE OR REPLACE FUNCTION public.tutors_normalize_hkd()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_rates numeric[];
BEGIN
  SELECT COALESCE(
    ARRAY(
      SELECT (tier->>'rate')::numeric
      FROM jsonb_array_elements(COALESCE(new.pricing_tiers, '[]'::jsonb)) AS tier
      WHERE jsonb_typeof(tier->'rate') = 'number'
    ),
    ARRAY[]::numeric[]
  ) INTO v_rates;

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
  BEFORE INSERT OR UPDATE OF currency, hourly_rate, pricing_tiers
  ON public.tutors
  FOR EACH ROW EXECUTE FUNCTION public.tutors_normalize_hkd();

COMMENT ON COLUMN public.tutors.currency IS
  'Currency of hourly_rate and pricing_tiers amounts (native input); HKD until per-tutor currency selection ships (#113).';
COMMENT ON COLUMN public.tutors.min_hourly_rate_hkd IS
  'HKD-normalized lowest hourly rate (flat rate or cheapest tier), snapshot at write time via the FX engine; powers price filtering and sorting.';
COMMENT ON COLUMN public.tutors.max_hourly_rate_hkd IS
  'HKD-normalized highest hourly rate (flat rate or priciest tier), snapshot at write time.';

-- Backfill all existing rows (every tutor is HKD today). Computed directly —
-- instead of forcing the trigger via "SET currency = currency" — so the
-- one-off backfill does not bump trigger-maintained updated_at values.
UPDATE public.tutors t
SET
  min_hourly_rate_hkd = public.normalize_to_hkd(
    COALESCE((
      SELECT min((tier->>'rate')::numeric)
      FROM jsonb_array_elements(COALESCE(t.pricing_tiers, '[]'::jsonb)) AS tier
      WHERE jsonb_typeof(tier->'rate') = 'number'
    ), t.hourly_rate::numeric),
    t.currency
  ),
  max_hourly_rate_hkd = public.normalize_to_hkd(
    COALESCE((
      SELECT max((tier->>'rate')::numeric)
      FROM jsonb_array_elements(COALESCE(t.pricing_tiers, '[]'::jsonb)) AS tier
      WHERE jsonb_typeof(tier->'rate') = 'number'
    ), t.hourly_rate::numeric),
    t.currency
  );

-- ---------------------------------------------------------------------------
-- 4. Case requests: native budget (budget_min/max, in budget_currency) with
--    HKD-normalized bounds maintained on write
-- ---------------------------------------------------------------------------

ALTER TABLE public.tutoring_cases
  ADD COLUMN IF NOT EXISTS budget_currency supported_currency NOT NULL DEFAULT 'HKD',
  ADD COLUMN IF NOT EXISTS budget_min_hkd numeric(12,2),
  ADD COLUMN IF NOT EXISTS budget_max_hkd numeric(12,2);

CREATE OR REPLACE FUNCTION public.cases_normalize_budget_hkd()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  new.budget_min_hkd := CASE
    WHEN new.budget_min IS NULL THEN NULL
    ELSE public.normalize_to_hkd(new.budget_min, new.budget_currency)
  END;
  new.budget_max_hkd := CASE
    WHEN new.budget_max IS NULL THEN NULL
    ELSE public.normalize_to_hkd(new.budget_max, new.budget_currency)
  END;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_cases_normalize_budget_hkd ON public.tutoring_cases;
CREATE TRIGGER trg_cases_normalize_budget_hkd
  BEFORE INSERT OR UPDATE OF budget_currency, budget_min, budget_max
  ON public.tutoring_cases
  FOR EACH ROW EXECUTE FUNCTION public.cases_normalize_budget_hkd();

COMMENT ON COLUMN public.tutoring_cases.budget_min IS
  'Native minimum hourly budget as entered by the requester, in budget_currency (HKD until the multi-currency form ships, #114).';
COMMENT ON COLUMN public.tutoring_cases.budget_max IS
  'Native maximum hourly budget as entered by the requester, in budget_currency.';
COMMENT ON COLUMN public.tutoring_cases.budget_currency IS
  'Currency of budget_min/budget_max (native input).';
COMMENT ON COLUMN public.tutoring_cases.budget_min_hkd IS
  'HKD-normalized budget_min, snapshot at write time via the FX engine; powers matching and cross-currency sorting.';
COMMENT ON COLUMN public.tutoring_cases.budget_max_hkd IS
  'HKD-normalized budget_max, snapshot at write time.';

-- Backfill existing rows (all budgets are HKD today).
UPDATE public.tutoring_cases c
SET
  budget_min_hkd = CASE
    WHEN c.budget_min IS NULL THEN NULL
    ELSE public.normalize_to_hkd(c.budget_min, c.budget_currency)
  END,
  budget_max_hkd = CASE
    WHEN c.budget_max IS NULL THEN NULL
    ELSE public.normalize_to_hkd(c.budget_max, c.budget_currency)
  END;

-- Normalized columns are snapshots taken at write time; daily FX drift is
-- acceptable. To re-normalize everything after a large rate move, run as the
-- service role:
--   UPDATE public.tutors SET pricing_tiers = pricing_tiers;   -- fires trigger
--   UPDATE public.tutoring_cases SET budget_min = budget_min; -- fires trigger

-- ---------------------------------------------------------------------------
-- 5. match_tutors_for_case: score budgets vs rates in normalized HKD so
--    matching stays correct across native currencies (falls back to the
--    legacy columns when normalized snapshots are missing)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.match_tutors_for_case(_case_id uuid, _limit integer DEFAULT 5)
RETURNS TABLE(id uuid, tutor_code text, display_name text, headline text, subjects text[], district text, hourly_rate integer, badge text, photo_url text, experience_years integer, languages text[], gender text, score numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c public.tutoring_cases%ROWTYPE;
  is_owner boolean;
  is_admin boolean;
BEGIN
  SELECT * INTO c FROM public.tutoring_cases WHERE tutoring_cases.id = _case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'case not found'; END IF;

  is_owner := (c.parent_id = auth.uid());
  is_admin := public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'staff');
  IF NOT (COALESCE(is_owner, false) OR COALESCE(is_admin, false)) THEN RAISE EXCEPTION 'forbidden'; END IF;

  RETURN QUERY
  SELECT
    t.id, t.tutor_code, t.display_name, t.headline,
    t.subjects, t.district, t.hourly_rate, t.badge,
    t.photo_url, t.experience_years, t.languages, t.gender,
    (
      (CASE WHEN EXISTS (
        SELECT 1 FROM unnest(c.subjects) cs
        WHERE EXISTS (SELECT 1 FROM unnest(t.subjects) ts WHERE lower(ts) = lower(cs))
      ) THEN 40 ELSE 0 END)
      + (CASE WHEN c.district IS NOT NULL AND c.district = ANY(t.stations) THEN 15 ELSE 0 END)
      + (CASE
           WHEN COALESCE(c.budget_max_hkd, c.budget_max) IS NULL OR COALESCE(c.budget_min_hkd, c.budget_min) IS NULL THEN 0
           WHEN COALESCE(t.min_hourly_rate_hkd, t.hourly_rate) BETWEEN COALESCE(c.budget_min_hkd, c.budget_min) AND COALESCE(c.budget_max_hkd, c.budget_max) THEN 15
           WHEN COALESCE(t.min_hourly_rate_hkd, t.hourly_rate) <= COALESCE(c.budget_max_hkd, c.budget_max) THEN 5
           ELSE 0 END)
      + (CASE
           WHEN c.mode = 'either' THEN 5
           WHEN t.lesson_mode::text = 'either' THEN 8
           WHEN c.mode::text = t.lesson_mode::text THEN 10
           ELSE 0 END)
      + (CASE
           WHEN c.preferred_gender = 'any' THEN 5
           WHEN t.gender IS NULL THEN 0
           WHEN c.preferred_gender::text = t.gender THEN 10
           ELSE 0 END)
      + (CASE
           WHEN c.tutor_background = 'any' THEN 5
           WHEN t.tutor_status IS NULL THEN 0
           WHEN c.tutor_background = 'uni_student' AND t.tutor_status = 'uni_student' THEN 15
           WHEN c.tutor_background = 'official_examiner' AND t.tutor_status = 'examiner' THEN 15
           ELSE 0 END)
      + (CASE
           WHEN c.language_of_instruction = 'either' THEN 5
           WHEN c.language_of_instruction = 'en' AND ('English' = ANY(t.languages) OR 'english' = ANY(t.languages)) THEN 10
           WHEN c.language_of_instruction = 'zh-HK' AND ('Cantonese' = ANY(t.languages) OR 'Chinese' = ANY(t.languages)) THEN 10
           ELSE 0 END)
      + (LEAST(COALESCE(t.experience_years,0), 10) * 1.0)
    )::numeric AS score
  FROM public.tutors t
  WHERE t.is_published = true
  ORDER BY score DESC, t.updated_at DESC
  LIMIT _limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.match_tutors_for_case(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.match_tutors_for_case(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_tutors_for_case(uuid, integer) TO authenticated;

COMMIT;
