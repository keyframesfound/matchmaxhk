-- Issue #459 slice 1: additive roles.
--
-- switch_role and complete_onboarding used to DELETE the other parent/tutor
-- row, so a tutor who switched to "parent" lost tutor access. Roles now only
-- ever get added here; the account type a user is acting as lives in
-- profiles.active_role. Card claiming (20261014200000) already adds 'tutor'
-- without removing 'parent', so it needs no change.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_role TEXT
    CHECK (active_role IN ('parent', 'tutor'));

COMMENT ON COLUMN public.profiles.active_role IS
  'Issue #459: account type the user is acting as (parent|tutor). Roles in user_roles are additive; this only picks which one the UI leads with.';

-- Backfill from today's single self-serve role: tutor if they hold it.
UPDATE public.profiles p
SET active_role = CASE
  WHEN EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = p.id AND r.role = 'tutor'
  ) THEN 'tutor'
  ELSE 'parent'
END
WHERE p.active_role IS NULL;

CREATE OR REPLACE FUNCTION public.switch_role(_role public.app_role)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _role NOT IN ('parent', 'tutor') THEN
    RAISE EXCEPTION 'Role cannot be changed here';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('super_admin', 'admin', 'staff')
  ) THEN
    RAISE EXCEPTION 'Managed roles cannot be changed here';
  END IF;

  -- Additive: keep every existing role, just make sure this one is held.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.profiles
  SET active_role = _role::text
  WHERE id = _user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.switch_role(public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.switch_role(public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_onboarding(_choice TEXT)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _choice NOT IN ('parent', 'tutor') THEN
    RAISE EXCEPTION 'Invalid onboarding choice';
  END IF;

  -- New signups already hold 'parent' (handle_new_user); choosing tutor
  -- adds 'tutor' alongside it. Admin/staff/super_admin rows are untouched.
  IF _choice = 'tutor' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'tutor')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  UPDATE public.profiles
  SET active_role = _choice,
      onboarding_completed_at = now()
  WHERE id = _user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_onboarding(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(TEXT) TO authenticated;
