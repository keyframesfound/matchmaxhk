-- Tutor join applications: in-site review flow.
-- Submissions are stored in the database (system of record) and reviewed in the
-- admin console; the email notification is demoted to a heads-up only.
-- Rejected applications stay recoverable for 30 days, then a daily pg_cron job
-- deletes them permanently.

CREATE TYPE public.tutor_application_status AS ENUM ('pending', 'accepted', 'rejected');

CREATE TABLE public.tutor_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status public.tutor_application_status NOT NULL DEFAULT 'pending',
  data jsonb NOT NULL,
  attachment_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  rejected_at timestamptz,
  purge_after timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.tutor_applications.data IS
  'Full tutor application payload as submitted from /join (zod-validated shape).';
COMMENT ON COLUMN public.tutor_applications.attachment_files IS
  'R2 uploads: [{ key, url, filename, contentType, size, source, label }].';

GRANT SELECT, UPDATE, DELETE ON public.tutor_applications TO authenticated;
GRANT ALL ON public.tutor_applications TO service_role;

ALTER TABLE public.tutor_applications ENABLE ROW LEVEL SECURITY;

-- Applicants submit anonymously through a server function using the service
-- role, so no anon INSERT policy is needed (and none is granted).
CREATE POLICY "tutor_applications_admin_select" ON public.tutor_applications
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "tutor_applications_admin_update" ON public.tutor_applications
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "tutor_applications_admin_delete" ON public.tutor_applications
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE TRIGGER trg_tutor_applications_updated_at BEFORE UPDATE ON public.tutor_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_tutor_applications_status ON public.tutor_applications(status, created_at);
CREATE INDEX idx_tutor_applications_purge
  ON public.tutor_applications(purge_after)
  WHERE status = 'rejected';

-- Daily purge: 30 days after a rejection, the row (and all submitted data) is
-- permanently deleted. Runs at 20:17 UTC (04:17 HKT) on the Supabase pooler.
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'purge-rejected-tutor-applications',
  '17 20 * * *',
  $$DELETE FROM public.tutor_applications
    WHERE status = 'rejected'
      AND purge_after IS NOT NULL
      AND purge_after < now()$$
);
