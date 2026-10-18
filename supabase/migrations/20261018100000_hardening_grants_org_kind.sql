-- Issues #376 (org kind lock + tutoring_cases column hygiene), #367 item 3
-- and #374 item 2 (defense-in-depth grants), part of the 2026-10-18
-- hardening batch.
--
-- RLS already enforces the real policy on every table touched here; these
-- REVOKEs remove standing table/column grants the client roles no longer
-- need, so a future RLS mistake cannot expose or mutate rows directly.
-- Every app write path for these tables goes through service-role server
-- fns (terms-acceptance.server.ts, credential-edit.functions.ts,
-- gig-staff/buyer.functions.ts) or SECURITY DEFINER RPCs, so nothing breaks.

-- #374 item 2: ghost strikes are written service-role only and read by
-- staff through the admin client (listGhostStrikes uses assertGigStaffDb).
REVOKE ALL ON public.tutor_ghost_strikes FROM anon, authenticated;

-- #367 item 3: acceptance rows are written service-role from each gate's
-- submit fn; owners only ever SELECT (fail-closed gates never trust the
-- client to record its own acceptance).
REVOKE INSERT, UPDATE, DELETE ON public.terms_acceptances FROM anon, authenticated;

-- #367 item 3: the credential-edit queue is written service-role; owners
-- have SELECT-only RLS and never write rows directly.
REVOKE INSERT, UPDATE, DELETE ON public.tutor_credential_edits FROM anon, authenticated;

-- #376 item 2: the secret case columns lost authenticated SELECT in the
-- #375 round-2 migration (sor_owner_column_freeze). The suggested
-- column-level REVOKE of INSERT/UPDATE turns out to be a NO-OP in Postgres:
-- those privileges derive from the TABLE-level INSERT/UPDATE grants
-- (verified live — role_column_grants still lists them after the column
-- REVOKE), and revoking the table grants would break the staff fee panel,
-- which writes hourly_rate_hkd through the staff JWT under the
-- cases_admin_all RLS policy (MatchFeePanel patchMutation). The defense
-- stays with RLS (staff-roles only) + the service-role app write paths;
-- moving the fee edit behind a server fn is the real follow-up if column
-- hygiene is wanted. Documented on issue #376.

-- #376 item 1: `organizations.kind = 'centre'` is admin-provisioned only
-- (product comment on the SoR work), but the INSERT policy lets any
-- authenticated user create an organization with any kind, and org admins
-- could flip kind on UPDATE. Lock it at the trigger level — RLS WITH CHECK
-- cannot compare NEW.kind against OLD.kind:
--   INSERT: only platform admins (or the service role) may create a centre.
--   UPDATE: nobody but platform admins may change kind at all.
-- The bypass check mirrors the existing protect_org_managed_columns trigger.
CREATE OR REPLACE FUNCTION public.enforce_org_kind_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF current_user IN ('postgres', 'service_role') OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.kind = 'centre' AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'centre organizations are provisioned by platform admins only'
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.kind IS DISTINCT FROM OLD.kind
    AND NOT public.is_platform_admin()
  THEN
    RAISE EXCEPTION 'organization kind is locked once created'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_organizations_kind_lock ON public.organizations;
CREATE TRIGGER trg_organizations_kind_lock
  BEFORE INSERT OR UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_org_kind_lock();
