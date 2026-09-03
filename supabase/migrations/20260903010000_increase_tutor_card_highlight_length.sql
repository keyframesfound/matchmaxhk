-- Increase the available space for tutor-card highlight rows.
-- Keep the three-row limit unchanged while allowing up to 60 characters per row.

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
        SELECT bool_and(char_length(value) <= 60)
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
