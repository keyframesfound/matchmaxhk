-- Hotfix for the live hole in #362 review A+B (issue #309).
-- Same class as #353 / #354: staff-only verification state was writable by
-- the owner JWT. 20261016100000 is already applied on project
-- igtqwupxipvxkrinaxiw (and may land in this repo later, with an earlier
-- timestamp). This file is safe to apply either after that migration or
-- before the column and table exist.
--
-- A. tutor_grades: authenticated tutors get SELECT only. App mutations
--    (create / upload / relabel / delete / staff review) go through
--    service-role server functions. service_role has BYPASSRLS, so dropping
--    the client write policy does not block those paths. INSERT/UPDATE/DELETE
--    grants are revoked from anon and authenticated so a later permissive
--    policy cannot reopen PostgREST writes.
--
-- B. tutors.approved_grade_labels: freeze on the owner path inside
--    tutors_owner_enforcement_guard, same bypass as the #354 enforcement
--    columns. service_role, auth.uid() IS NULL (SQL editor, migrations, the
--    refresh_tutor_approved_grades trigger when it runs as service role),
--    and staff editing someone else's card still pass. A staff member
--    editing the card they own is the owner path and cannot spoof the badge.
--    The tutors table-level UPDATE grant is left in place on purpose: it
--    covers the whole live column set, and replacing it with an explicit
--    column list (the profiles approach in #354) would drop UPDATE on every
--    column added afterward. card_hidden_by_ban is frozen the same way.

-- ---------------------------------------------------------------------------
-- A. tutor_grades — SELECT only for the owning tutor
-- ---------------------------------------------------------------------------
DO $policy$
BEGIN
  IF to_regclass('public.tutor_grades') IS NULL THEN
    RAISE NOTICE 'tutor_grades is absent; SELECT-only policy waits for 20261016100000';
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS "Tutors manage own grades" ON public.tutor_grades';
  EXECUTE 'DROP POLICY IF EXISTS "Tutors read own grades" ON public.tutor_grades';
  EXECUTE $sql$
    CREATE POLICY "Tutors read own grades"
      ON public.tutor_grades
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.tutors t
          WHERE t.id = tutor_grades.tutor_id AND t.user_id = auth.uid()
        )
      )
  $sql$;

  -- service_role keeps the table grants from 20261016100000 and bypasses RLS.
  EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON TABLE public.tutor_grades FROM authenticated, anon';
END;
$policy$;

-- ---------------------------------------------------------------------------
-- B. tutors.approved_grade_labels — owner path cannot write the badge
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tutors_owner_enforcement_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_is_staff boolean;
  owner_status text;
BEGIN
  IF auth.role() = 'service_role' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  caller_is_staff :=
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'staff');

  IF caller_is_staff AND NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  -- Owner path (the card's user_id is the caller), including staff who
  -- own this card. Enforcement columns are trigger- and staff-maintained.
  -- approved_grade_labels is compared through to_jsonb so this function
  -- still loads on a database where 20261016100000 has not created the
  -- column yet: a missing key yields NULL on both sides, which is not
  -- distinct, so the check is a no-op until the column exists.
  IF NEW.card_hidden_by_ban IS DISTINCT FROM OLD.card_hidden_by_ban
     OR NEW.owner_account_status IS DISTINCT FROM OLD.owner_account_status
     OR (to_jsonb(NEW) -> 'approved_grade_labels')
        IS DISTINCT FROM (to_jsonb(OLD) -> 'approved_grade_labels')
  THEN
    RAISE EXCEPTION 'enforcement columns are locked'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT p.account_status INTO owner_status
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  -- Fail closed: a missing profile is not an active account. Suspended
  -- and banned owners cannot write the card at all, so they cannot
  -- republish or edit around the freeze.
  IF owner_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'account is not active'
      USING ERRCODE = 'P0001';
  END IF;

  -- Active owners may still hide or show their own card (issue #101).
  -- A card the ban flow unpublished stays hidden until service-role
  -- restore clears card_hidden_by_ban, even if the profile is already
  -- active again.
  IF OLD.card_hidden_by_ban
     AND NEW.is_published IS DISTINCT FROM OLD.is_published
  THEN
    RAISE EXCEPTION 'this card was unpublished by a ban'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.tutors_owner_enforcement_guard() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_tutors_owner_enforcement_guard ON public.tutors;
CREATE TRIGGER trg_tutors_owner_enforcement_guard
  BEFORE UPDATE ON public.tutors
  FOR EACH ROW
  EXECUTE FUNCTION public.tutors_owner_enforcement_guard();
