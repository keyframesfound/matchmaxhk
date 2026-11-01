-- Issues #548 (Unified Channel Profile + Pro-Bono signalling) + #550
-- (B2B Centre Workspace) shared schema.
--
--   tutors += pro-bono supply settings (public signalling, no student data)
--   tutoring_cases += PRIVATE pro-bono request fields (tutor/staff-only,
--                     never rendered on any student-facing surface)
--   centre_affiliations = user ↔ organization links (pending → approved)
--   workspace_members / workspace_audit_logs = #550 multi-staff workspaces
--
-- Posture: new tables are RLS on with NO client grants (service-role only,
-- students/ledger precedent); reads/writes go through server fns.

ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS accepts_pro_bono boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_reduced_rate boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reduced_hourly_rate_hkd integer
    CHECK (reduced_hourly_rate_hkd IS NULL OR reduced_hourly_rate_hkd BETWEEN 0 AND 5000),
  ADD COLUMN IF NOT EXISTS pro_bono_max_slots smallint NOT NULL DEFAULT 0
    CHECK (pro_bono_max_slots BETWEEN 0 AND 10);

ALTER TABLE public.tutoring_cases
  ADD COLUMN IF NOT EXISTS pro_bono_request boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pro_bono_note text
    CHECK (pro_bono_note IS NULL OR char_length(pro_bono_note) <= 500);

COMMENT ON COLUMN public.tutoring_cases.pro_bono_request IS
  '#548: private learner request for pro-bono / reduced rate. Visible ONLY to the matched tutor + staff; never on public surfaces.';

CREATE TABLE IF NOT EXISTS public.centre_affiliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  centre_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role_type text NOT NULL CHECK (role_type IN ('affiliated_tutor', 'alumni_student')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'withdrawn')),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  UNIQUE (user_id, centre_id)
);

CREATE INDEX IF NOT EXISTS idx_centre_affiliations_centre
  ON public.centre_affiliations (centre_id) WHERE status = 'approved';

ALTER TABLE public.centre_affiliations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.centre_affiliations FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.centre_affiliations TO service_role;

-- #550: append-only audit (invite/remove/reply-as-centre).
CREATE TABLE IF NOT EXISTS public.workspace_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (char_length(action) <= 60),
  target text CHECK (target IS NULL OR char_length(target) <= 200),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspace_audit_logs FROM anon, authenticated;
GRANT SELECT, INSERT ON public.workspace_audit_logs TO service_role;

COMMENT ON TABLE public.workspace_members IS
  'Issue #550: centre workspace staff (owner/admin, invited/active/revoked). Service-role only via workspace.functions.ts.';
