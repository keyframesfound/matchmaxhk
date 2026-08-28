CREATE TABLE IF NOT EXISTS public.saved_tutors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES public.tutors(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, tutor_id)
);

GRANT SELECT, INSERT, DELETE ON public.saved_tutors TO authenticated;
GRANT ALL ON public.saved_tutors TO service_role;

ALTER TABLE public.saved_tutors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved tutors"
  ON public.saved_tutors FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save tutors"
  ON public.saved_tutors FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own saved tutors"
  ON public.saved_tutors FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme_preference text NOT NULL DEFAULT 'system';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_theme_preference_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_theme_preference_check
  CHECK (theme_preference IN ('system', 'light', 'dark'));