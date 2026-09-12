-- Reduce tutor-card highlight rows back to a 50-character limit per row.
-- Keep the three-row limit unchanged.

-- Truncate existing rows that exceed the new limit so the constraint validates.
UPDATE public.tutors
SET card_highlights = (
  SELECT COALESCE(array_agg(LEFT(value, 50)), '{}'::text[])
  FROM unnest(card_highlights) AS value
)
WHERE EXISTS (
  SELECT 1
  FROM unnest(card_highlights) AS value
  WHERE char_length(value) > 50
);

CREATE OR REPLACE FUNCTION public.tutor_card_highlights_valid(highlight_values text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    highlight_values IS NOT NULL
    AND cardinality(highlight_values) <= 3
    AND COALESCE(
      (
        SELECT bool_and(char_length(value) <= 50)
        FROM unnest(highlight_values) AS value
      ),
      true
    );
$$;

-- Revalidate the existing constraint against the updated function definition.
ALTER TABLE public.tutors
  DROP CONSTRAINT IF EXISTS tutors_card_highlights_valid_check;

ALTER TABLE public.tutors
  ADD CONSTRAINT tutors_card_highlights_valid_check
  CHECK (public.tutor_card_highlights_valid(card_highlights));

COMMENT ON COLUMN public.tutors.card_highlights IS
  'Up to three concise tutor-card rows; each row is limited to 50 characters.';