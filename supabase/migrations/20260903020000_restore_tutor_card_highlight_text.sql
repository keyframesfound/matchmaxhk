-- Restore legacy headline text that was truncated during the original card-highlights backfill.
-- Only rows whose current value exactly matches the original 40-character prefix are updated.

BEGIN;

UPDATE public.tutors
SET card_highlights = ARRAY[
  LEFT(BTRIM(headline), 60)
]::text[]
WHERE cardinality(card_highlights) = 1
  AND char_length(card_highlights[1]) = 40
  AND NULLIF(BTRIM(headline), '') IS NOT NULL
  AND LEFT(BTRIM(headline), 40) = card_highlights[1];

COMMENT ON COLUMN public.tutors.card_highlights IS
  'Up to three concise tutor-card rows; each row is limited to 60 characters.';

COMMIT;
