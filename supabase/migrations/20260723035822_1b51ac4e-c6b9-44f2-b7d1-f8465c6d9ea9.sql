ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS exam_results jsonb NOT NULL DEFAULT '[]'::jsonb;