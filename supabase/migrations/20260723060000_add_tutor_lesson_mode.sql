ALTER TABLE public.tutors
ADD COLUMN IF NOT EXISTS lesson_mode public.case_mode NOT NULL DEFAULT 'either';