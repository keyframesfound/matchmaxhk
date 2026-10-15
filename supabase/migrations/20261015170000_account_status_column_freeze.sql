-- Issue #353: freeze suspend/ban columns against owner JWT writes.
--
-- #308 / #352 added profiles.account_status* and the tutor mirror
-- (owner_account_status, card_hidden_by_ban, ban unpublish) without
-- column freezes. "Users can update own profile" plus a table-level
-- GRANT UPDATE let an owner set account_status back to 'active', which
-- also fires trg_sync_tutor_owner_account_status and restores
-- Request-tutor. tutors_owner_update only pins user_id, so the same JWT
-- could republish a ban-hidden card, clear card_hidden_by_ban, or spoof
-- owner_account_status.
--
-- Staff suspend/ban/restore (setAccountStatus) writes through the
-- service-role client. The admin tutor console publishes with a staff
-- JWT against someone else's card. Both paths stay open. Issue #101's
-- owner visibility toggle (is_published) stays open only while the
-- account is active and the card is not ban-hidden.

-- ---------------------------------------------------------------------------
-- 1. profiles.account_status* — authenticated JWTs cannot write them
-- ---------------------------------------------------------------------------
-- PostgreSQL ORs table-level and column-level privileges, so
-- REVOKE UPDATE (col) is a no-op while GRANT UPDATE ON the table remains.
-- Replace the table grant with every existing profiles column except the
-- three enforcement columns. service_role keeps GRANT ALL from the
-- foundation migration. INSERT is unchanged (the row already exists; the
-- live hole is UPDATE).

REVOKE UPDATE ON TABLE public.profiles FROM authenticated;

GRANT UPDATE (
  id,
  email,
  display_name,
  phone,
  locale,
  avatar_url,
  created_at,
  updated_at,
  theme_preference,
  notification_preferences,
  tos_accepted_at,
  tos_version,
  onboarding_completed_at,
  community_commitment_at,
  community_commitment_version,
  google_sub
) ON TABLE public.profiles TO authenticated;

-- Defense in depth if a later migration restores table-level UPDATE.
-- There is no admin UPDATE policy on profiles — staff change status only
-- via the service-role server functions — so an authenticated JWT,
-- including a staff member editing their own row, is never a legitimate
-- writer of these columns. auth.uid() IS NULL covers service_role (no
-- sub claim), the SQL editor, and migrations.
CREATE OR REPLACE FUNCTION public.profiles_account_status_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.account_status IS NOT DISTINCT FROM OLD.account_status
     AND NEW.account_status_reason IS NOT DISTINCT FROM OLD.account_status_reason
     AND NEW.account_status_at IS NOT DISTINCT FROM OLD.account_status_at
  THEN
    RETURN NEW;
  END IF;

  IF auth.role() = 'service_role' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'account status can only be changed by staff'
    USING ERRCODE = 'P0001';
END;
$function$;

REVOKE ALL ON FUNCTION public.profiles_account_status_guard() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_profiles_account_status_guard ON public.profiles;
CREATE TRIGGER trg_profiles_account_status_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_account_status_guard();

-- ---------------------------------------------------------------------------
-- 2. tutors — owner path cannot undo ban/suspend enforcement
-- ---------------------------------------------------------------------------
-- Same bypass shape as tutors_owner_verified_guard, with one tightening:
-- a staff member editing the card they own is still the owner path.
-- Service-role (auth.uid() IS NULL / auth.role() = service_role) and
-- staff editing someone else's card (admin console, report unpublish)
-- pass through, including the sync_tutor_owner_account_status mirror.
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
  IF NEW.card_hidden_by_ban IS DISTINCT FROM OLD.card_hidden_by_ban
     OR NEW.owner_account_status IS DISTINCT FROM OLD.owner_account_status
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
