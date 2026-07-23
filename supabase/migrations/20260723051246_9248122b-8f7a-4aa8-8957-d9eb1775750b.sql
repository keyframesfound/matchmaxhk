
-- Enums
CREATE TYPE public.case_status AS ENUM ('pending','approved','matched','closed','rejected');
CREATE TYPE public.case_mode AS ENUM ('online','in_person','either');
CREATE TYPE public.case_gender_pref AS ENUM ('any','male','female');
CREATE TYPE public.case_urgency AS ENUM ('low','normal','high');
CREATE TYPE public.case_interest_status AS ENUM ('pending','contact_released','declined');

-- tutoring_cases
CREATE TABLE public.tutoring_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  subject text NOT NULL,
  exam_system text,
  student_level text NOT NULL,
  student_grade_current text,
  student_school text,
  district text,
  mode public.case_mode NOT NULL DEFAULT 'either',
  sessions_per_week int NOT NULL DEFAULT 1,
  session_length_minutes int NOT NULL DEFAULT 60,
  start_date date,
  schedule_note text,
  preferred_gender public.case_gender_pref NOT NULL DEFAULT 'any',
  language_of_instruction text NOT NULL DEFAULT 'either',
  preferred_tutor_type text NOT NULL DEFAULT 'any',
  urgency public.case_urgency NOT NULL DEFAULT 'normal',
  budget_min int,
  budget_max int,
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  whatsapp_ok boolean NOT NULL DEFAULT true,
  status public.case_status NOT NULL DEFAULT 'pending',
  admin_notes text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutoring_cases TO authenticated;
GRANT ALL ON public.tutoring_cases TO service_role;

ALTER TABLE public.tutoring_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cases_owner_select" ON public.tutoring_cases FOR SELECT TO authenticated
USING (auth.uid() = parent_id);
CREATE POLICY "cases_owner_insert" ON public.tutoring_cases FOR INSERT TO authenticated
WITH CHECK (auth.uid() = parent_id);
CREATE POLICY "cases_owner_update" ON public.tutoring_cases FOR UPDATE TO authenticated
USING (auth.uid() = parent_id) WITH CHECK (auth.uid() = parent_id);
CREATE POLICY "cases_owner_delete" ON public.tutoring_cases FOR DELETE TO authenticated
USING (auth.uid() = parent_id);

CREATE POLICY "cases_admin_all" ON public.tutoring_cases FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'staff'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'staff'));

-- Tutors can read approved+public cases (safe columns projected client-side; contact fields also filtered in server fn)
CREATE POLICY "cases_public_read_approved" ON public.tutoring_cases FOR SELECT TO authenticated
USING (is_public = true AND status IN ('approved','matched'));

CREATE TRIGGER trg_cases_updated_at BEFORE UPDATE ON public.tutoring_cases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_cases_status ON public.tutoring_cases(status);
CREATE INDEX idx_cases_public ON public.tutoring_cases(is_public, status);
CREATE INDEX idx_cases_parent ON public.tutoring_cases(parent_id);

-- case_interests
CREATE TABLE public.case_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.tutoring_cases(id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES public.tutors(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note text,
  status public.case_interest_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, tutor_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_interests TO authenticated;
GRANT ALL ON public.case_interests TO service_role;

ALTER TABLE public.case_interests ENABLE ROW LEVEL SECURITY;

-- Tutor who submitted can select/insert own; only admin can update status
CREATE POLICY "interests_submitter_select" ON public.case_interests FOR SELECT TO authenticated
USING (submitted_by = auth.uid());
CREATE POLICY "interests_submitter_insert" ON public.case_interests FOR INSERT TO authenticated
WITH CHECK (submitted_by = auth.uid());

-- Case owner (parent) can see interests on their cases
CREATE POLICY "interests_case_owner_select" ON public.case_interests FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.tutoring_cases c WHERE c.id = case_id AND c.parent_id = auth.uid()));

CREATE POLICY "interests_admin_all" ON public.case_interests FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'staff'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'staff'));

CREATE TRIGGER trg_interests_updated_at BEFORE UPDATE ON public.case_interests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_interests_case ON public.case_interests(case_id);
CREATE INDEX idx_interests_tutor ON public.case_interests(tutor_id);

-- Match function
CREATE OR REPLACE FUNCTION public.match_tutors_for_case(_case_id uuid, _limit int DEFAULT 5)
RETURNS TABLE (
  id uuid, tutor_code text, display_name text, headline text,
  subjects text[], district text, hourly_rate int, rating numeric,
  review_count int, photo_url text, badge text, experience_years int,
  languages text[], score numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.tutoring_cases%ROWTYPE;
  is_owner boolean;
  is_admin boolean;
BEGIN
  SELECT * INTO c FROM public.tutoring_cases WHERE tutoring_cases.id = _case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'case not found'; END IF;

  is_owner := (c.parent_id = auth.uid());
  is_admin := public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'staff');
  IF NOT (is_owner OR is_admin) THEN RAISE EXCEPTION 'forbidden'; END IF;

  RETURN QUERY
  SELECT
    t.id, t.tutor_code, t.display_name, t.headline,
    t.subjects, t.district, t.hourly_rate, t.rating,
    t.review_count, t.photo_url, t.badge, t.experience_years,
    t.languages,
    (
      (CASE WHEN c.subject = ANY(t.subjects) THEN 40 ELSE 0 END)
      + (CASE WHEN c.district IS NOT NULL AND c.district = t.district THEN 15 ELSE 0 END)
      + (CASE
           WHEN c.budget_max IS NULL OR c.budget_min IS NULL THEN 0
           WHEN t.hourly_rate BETWEEN c.budget_min AND c.budget_max THEN 15
           WHEN t.hourly_rate <= c.budget_max THEN 5
           ELSE 0
         END)
      + (CASE
           WHEN c.language_of_instruction = 'either' THEN 5
           WHEN c.language_of_instruction = 'en' AND ('English' = ANY(t.languages) OR 'english' = ANY(t.languages)) THEN 10
           WHEN c.language_of_instruction = 'zh-HK' AND ('Cantonese' = ANY(t.languages) OR 'Chinese' = ANY(t.languages)) THEN 10
           ELSE 0
         END)
      + (LEAST(COALESCE(t.experience_years,0), 10) * 1.0)
      + (COALESCE(t.rating,0) * 5)
    )::numeric AS score
  FROM public.tutors t
  WHERE t.is_published = true
  ORDER BY score DESC, t.weekly_score DESC, t.rating DESC
  LIMIT _limit;
END;
$$;

REVOKE ALL ON FUNCTION public.match_tutors_for_case(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_tutors_for_case(uuid, int) TO authenticated;
