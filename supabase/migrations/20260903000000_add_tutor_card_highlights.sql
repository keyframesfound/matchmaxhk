BEGIN;

ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS card_highlights text[] NOT NULL DEFAULT '{}'::text[];

UPDATE public.tutors
SET card_highlights = ARRAY[
  LEFT(NULLIF(BTRIM(headline), ''), 40)
]::text[]
WHERE cardinality(card_highlights) = 0
  AND NULLIF(BTRIM(headline), '') IS NOT NULL;

CREATE OR REPLACE FUNCTION public.tutor_card_highlights_valid(highlight_values text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    cardinality(COALESCE(highlight_values, '{}'::text[])) <= 3
    AND COALESCE(
      (
        SELECT bool_and(char_length(value) <= 40)
        FROM unnest(COALESCE(highlight_values, '{}'::text[])) AS value
      ),
      true
    );
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tutors_card_highlights_valid_check'
      AND conrelid = 'public.tutors'::regclass
  ) THEN
    ALTER TABLE public.tutors
      ADD CONSTRAINT tutors_card_highlights_valid_check
      CHECK (public.tutor_card_highlights_valid(card_highlights));
  END IF;
END $$;

COMMENT ON COLUMN public.tutors.card_highlights IS
  'Up to three concise tutor-card rows; each row is limited to 40 characters.';

COMMIT;
