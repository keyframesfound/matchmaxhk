BEGIN;

ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS pricing_tiers jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.tutor_pricing_tiers_valid(tier_values jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_typeof(COALESCE(tier_values, '[]'::jsonb)) = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(tier_values, '[]'::jsonb)) AS tier
      WHERE jsonb_typeof(tier) <> 'object'
         OR jsonb_typeof(tier->'curriculum') <> 'string'
         OR BTRIM(tier->>'curriculum') = ''
         OR CHAR_LENGTH(BTRIM(tier->>'curriculum')) > 80
         OR jsonb_typeof(tier->'rate') <> 'number'
         OR (tier->>'rate')::numeric < 0
         OR (tier->>'rate')::numeric > 100000
    );
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tutors_pricing_tiers_valid_check'
      AND conrelid = 'public.tutors'::regclass
  ) THEN
    ALTER TABLE public.tutors
      ADD CONSTRAINT tutors_pricing_tiers_valid_check
      CHECK (public.tutor_pricing_tiers_valid(pricing_tiers));
  END IF;
END $$;

COMMENT ON COLUMN public.tutors.pricing_tiers IS
  'Optional per-curriculum hourly rates as [{"curriculum":"DSE","rate":400}]; public surfaces fall back to hourly_rate when empty.';

COMMIT;
