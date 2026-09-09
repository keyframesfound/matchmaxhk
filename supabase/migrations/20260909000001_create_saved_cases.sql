CREATE TABLE IF NOT EXISTS public.saved_cases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.tutoring_cases(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, case_id)
);

GRANT SELECT, INSERT, DELETE ON public.saved_cases TO authenticated;
GRANT ALL ON public.saved_cases TO service_role;

ALTER TABLE public.saved_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved cases"
  ON public.saved_cases FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save cases"
  ON public.saved_cases FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own saved cases"
  ON public.saved_cases FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
