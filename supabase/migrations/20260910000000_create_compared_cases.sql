CREATE TABLE IF NOT EXISTS public.compared_cases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.tutoring_cases(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, case_id)
);

GRANT SELECT, INSERT, DELETE ON public.compared_cases TO authenticated;
GRANT ALL ON public.compared_cases TO service_role;

ALTER TABLE public.compared_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own compared cases"
  ON public.compared_cases FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can compare cases"
  ON public.compared_cases FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own compared cases"
  ON public.compared_cases FOR DELETE TO authenticated
  USING (auth.uid() = user_id);