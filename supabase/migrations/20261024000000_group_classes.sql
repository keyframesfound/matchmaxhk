-- Issue #391 — Small Group Classes (1.5-lesson fee per student).
--
-- Tutors offer open group cohorts (1-to-2 up to 1-to-6) at a lower
-- per-student rate. Parents enrol students — possibly several siblings in
-- one booking — and each booking spawns ONE isolated 1-on-1 tutoring_case
-- (group_cohort_id + student_count) so unrelated parents in the same cohort
-- never see each other (PDPO Cap. 486): contact fields, chats and fees stay
-- per-case, exactly like 1-on-1 tutoring.
--
-- Cap. 279 guardrail (initial launch, CEO sequencing 2026-10-19): the hard
-- 6-seat cap applies to every tutor. The verified-EDB-centre higher-cap path
-- (is_edb_registered / verified_max_capacity) ships only after the digital
-- shop (#392) is live — when it does, max_seats' CHECK widens; nothing here
-- hardcodes 6 outside that single CHECK pair.

CREATE TABLE public.group_cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES public.tutors(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) <= 120),
  curriculum text NOT NULL CHECK (char_length(curriculum) <= 40),
  subject text NOT NULL CHECK (char_length(subject) <= 120),
  student_level text NOT NULL CHECK (char_length(student_level) <= 80),
  weekly_schedule text NOT NULL CHECK (char_length(weekly_schedule) <= 120),
  mode text NOT NULL CHECK (mode IN ('online', 'in_person')),
  district text CHECK (char_length(district) <= 80),
  per_student_rate_hkd integer NOT NULL
    CHECK (per_student_rate_hkd >= 50 AND per_student_rate_hkd <= 3000),
  -- min_seats can be 1 (tutor confirms an early start immediately);
  -- max_seats is the hard 2-6 Cap. 279 band.
  min_seats integer NOT NULL DEFAULT 2 CHECK (min_seats >= 1 AND min_seats <= 6),
  max_seats integer NOT NULL CHECK (max_seats >= 2 AND max_seats <= 6),
  description text CHECK (char_length(description) <= 1000),
  -- forming = recruiting; running = tutor confirmed an early start (or the
  -- min-seats bar was met); closed = no longer bookable.
  status text NOT NULL DEFAULT 'forming'
    CHECK (status IN ('forming', 'running', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT group_cohorts_seats_order_chk CHECK (min_seats <= max_seats),
  CONSTRAINT group_cohorts_inperson_district_chk
    CHECK (mode <> 'in_person' OR district IS NOT NULL)
);

GRANT SELECT ON public.group_cohorts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_cohorts TO authenticated;
GRANT ALL ON public.group_cohorts TO service_role;

ALTER TABLE public.group_cohorts ENABLE ROW LEVEL SECURITY;

-- Cohorts are a public marketing surface: title, subject, schedule, rate and
-- seats — no contact data lives on the row (description is contact-filtered
-- at the app layer), so anyone may read.
CREATE POLICY "group_cohorts_public_read" ON public.group_cohorts
  FOR SELECT USING (true);

-- Tutor-owned writes: the caller must own the linked tutors row
-- (tutors.user_id = auth.uid()), mirroring the owner-write guard on tutors.
CREATE POLICY "group_cohorts_owner_insert" ON public.group_cohorts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tutors t
      WHERE t.id = group_cohorts.tutor_id AND t.user_id = auth.uid()
    )
  );
CREATE POLICY "group_cohorts_owner_update" ON public.group_cohorts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tutors t
      WHERE t.id = group_cohorts.tutor_id AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tutors t
      WHERE t.id = group_cohorts.tutor_id AND t.user_id = auth.uid()
    )
  );
CREATE POLICY "group_cohorts_owner_delete" ON public.group_cohorts
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tutors t
      WHERE t.id = group_cohorts.tutor_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "group_cohorts_admin_all" ON public.group_cohorts FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'staff')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'staff')
);

CREATE TRIGGER trg_group_cohorts_updated_at BEFORE UPDATE ON public.group_cohorts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_group_cohorts_tutor ON public.group_cohorts(tutor_id, status);
CREATE INDEX idx_group_cohorts_open ON public.group_cohorts(status, created_at DESC);

-- Case-side links. class_format_preference is the #391 parent request-form
-- selector (1-on-1 only | open to small group | either); group_cohort_id
-- ties a booking's case back to its cohort. Both nullable — every legacy
-- row stays valid untouched.
ALTER TABLE public.tutoring_cases
  ADD COLUMN IF NOT EXISTS group_cohort_id uuid REFERENCES public.group_cohorts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS class_format_preference text
    CHECK (class_format_preference IN ('one_on_one_only', 'open_to_group', 'either'));

CREATE INDEX IF NOT EXISTS idx_cases_cohort ON public.tutoring_cases(group_cohort_id);

COMMENT ON TABLE public.group_cohorts IS
  'Issue #391: small-group class cohorts (2-6 seats, Cap. 279). Seats taken are derived from tutoring_cases.student_count where group_cohort_id matches — never stored.';
COMMENT ON COLUMN public.tutoring_cases.class_format_preference IS
  'Issue #391: parent request-form class format preference. Null for legacy rows and cohort bookings.';
