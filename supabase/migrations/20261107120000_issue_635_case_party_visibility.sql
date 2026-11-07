-- #635: per-party visibility and masks for Active Cases on profiles. No row
-- means the defaults: shown, nothing masked. Service-role only: RLS on with no
-- policies, reads and writes go through server functions.
CREATE TABLE IF NOT EXISTS public.case_party_visibility (
  case_id uuid NOT NULL REFERENCES public.tutoring_cases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  show_on_public_profile boolean NOT NULL DEFAULT true,
  mask_rate boolean NOT NULL DEFAULT false,
  mask_student_name boolean NOT NULL DEFAULT false,
  mask_fine_district boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (case_id, user_id)
);

ALTER TABLE public.case_party_visibility ENABLE ROW LEVEL SECURITY;
