
-- 1. Tutor profile extensions
ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS education jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS experience_years int,
  ADD COLUMN IF NOT EXISTS teaching_since int,
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS intro_video_url text;

ALTER TABLE public.tutors ALTER COLUMN rating SET DEFAULT 5.0;
ALTER TABLE public.tutors ALTER COLUMN weekly_rating SET DEFAULT 5.0;

-- 2. tutor_reviews table
CREATE TABLE IF NOT EXISTS public.tutor_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES public.tutors(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_alias text NOT NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tutor_reviews_one_per_user
  ON public.tutor_reviews (tutor_id, author_user_id)
  WHERE author_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tutor_reviews_tutor_idx
  ON public.tutor_reviews (tutor_id, created_at DESC);

GRANT SELECT ON public.tutor_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutor_reviews TO authenticated;
GRANT ALL ON public.tutor_reviews TO service_role;

ALTER TABLE public.tutor_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published reviews"
  ON public.tutor_reviews FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

CREATE POLICY "Admins can view all reviews"
  ON public.tutor_reviews FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users insert their own review"
  ON public.tutor_reviews FOR INSERT
  TO authenticated
  WITH CHECK (author_user_id = auth.uid());

CREATE POLICY "Users update their own review"
  ON public.tutor_reviews FOR UPDATE
  TO authenticated
  USING (author_user_id = auth.uid())
  WITH CHECK (author_user_id = auth.uid());

CREATE POLICY "Users delete their own review"
  ON public.tutor_reviews FOR DELETE
  TO authenticated
  USING (author_user_id = auth.uid());

CREATE POLICY "Admins insert any review"
  ON public.tutor_reviews FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins update any review"
  ON public.tutor_reviews FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins delete any review"
  ON public.tutor_reviews FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_tutor_reviews_updated_at
  BEFORE UPDATE ON public.tutor_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Auto-refresh tutor rating aggregates
CREATE OR REPLACE FUNCTION public.refresh_tutor_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_tutor uuid;
  avg_rating numeric(2,1);
  cnt int;
BEGIN
  target_tutor := COALESCE(NEW.tutor_id, OLD.tutor_id);
  SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 5.0), COUNT(*)
    INTO avg_rating, cnt
  FROM public.tutor_reviews
  WHERE tutor_id = target_tutor AND is_published = true;

  UPDATE public.tutors
    SET rating = avg_rating,
        review_count = cnt
  WHERE id = target_tutor;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER tutor_reviews_refresh_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.tutor_reviews
  FOR EACH ROW EXECUTE FUNCTION public.refresh_tutor_rating();
