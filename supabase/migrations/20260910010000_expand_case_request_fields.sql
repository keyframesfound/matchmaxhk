-- Expanded tutor request form (3-step wizard): store the new structured
-- request fields alongside the legacy columns.
ALTER TABLE public.tutoring_cases
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS requester_type text,
  ADD COLUMN IF NOT EXISTS support_type text,
  ADD COLUMN IF NOT EXISTS specific_component text,
  ADD COLUMN IF NOT EXISTS target_pathway text,
  ADD COLUMN IF NOT EXISTS target_school text,
  ADD COLUMN IF NOT EXISTS interview_test text,
  ADD COLUMN IF NOT EXISTS school_type text,
  ADD COLUMN IF NOT EXISTS tutor_background text;

COMMENT ON COLUMN public.tutoring_cases.requester_type IS 'Who submitted the request: parent or student.';
COMMENT ON COLUMN public.tutoring_cases.support_type IS 'Request path: subject_tutoring (school exams) or admissions (university/standardized tests).';
COMMENT ON COLUMN public.tutoring_cases.specific_component IS 'Curriculum-specific component, e.g. IA/EE/TOK for IB, Phonics for primary.';
COMMENT ON COLUMN public.tutoring_cases.tutor_background IS 'Preferred tutor background: uni_student, official_examiner, or any.';
