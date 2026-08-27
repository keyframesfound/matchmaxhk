ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS achievements jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ia_ee_tok_support text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS ia_ee_tok_notes text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tutors_achievements_array_max_three_check'
      AND conrelid = 'public.tutors'::regclass
  ) THEN
    ALTER TABLE public.tutors
      ADD CONSTRAINT tutors_achievements_array_max_three_check
      CHECK (jsonb_typeof(achievements) = 'array' AND jsonb_array_length(achievements) <= 3);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tutors_ia_ee_tok_support_values_check'
      AND conrelid = 'public.tutors'::regclass
  ) THEN
    ALTER TABLE public.tutors
      ADD CONSTRAINT tutors_ia_ee_tok_support_values_check
      CHECK (ia_ee_tok_support <@ ARRAY['IA', 'EE', 'TOK']::text[]);
  END IF;
END $$;

UPDATE public.tutors
SET
  achievements = COALESCE(achievements, '[]'::jsonb),
  ia_ee_tok_support = COALESCE(ia_ee_tok_support, '{}'::text[])
WHERE achievements IS NULL OR ia_ee_tok_support IS NULL;

COMMENT ON COLUMN public.tutors.achievements IS
  'Up to three tutor achievements, each stored as { short_text: string, detail_text?: string }.';
COMMENT ON COLUMN public.tutors.ia_ee_tok_support IS
  'IA, EE, and/or TOK mentoring support offered by the tutor.';
COMMENT ON COLUMN public.tutors.ia_ee_tok_notes IS
  'Optional elaboration of the tutor''s IA, EE, and TOK mentoring support.';
