
CREATE TABLE public.tutors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  display_name TEXT NOT NULL,
  headline TEXT,
  subjects TEXT[] NOT NULL DEFAULT '{}',
  district TEXT,
  hourly_rate INT NOT NULL DEFAULT 0,
  badge TEXT,
  bio TEXT,
  photo_url TEXT,
  tutor_code TEXT NOT NULL UNIQUE,
  rating NUMERIC(2,1) NOT NULL DEFAULT 0,
  review_count INT NOT NULL DEFAULT 0,
  weekly_rating NUMERIC(2,1) NOT NULL DEFAULT 0,
  weekly_score INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tutors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutors TO authenticated;
GRANT ALL ON public.tutors TO service_role;

ALTER TABLE public.tutors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published tutors"
  ON public.tutors FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

CREATE POLICY "Admins can view all tutors"
  ON public.tutors FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can insert tutors"
  ON public.tutors FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can update tutors"
  ON public.tutors FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can delete tutors"
  ON public.tutors FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_tutors_updated_at
  BEFORE UPDATE ON public.tutors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX tutors_ranking_idx ON public.tutors (is_published, weekly_score DESC, weekly_rating DESC, rating DESC);
