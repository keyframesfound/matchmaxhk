-- Issue #459 slice 5: zero-lock-in onboarding (§A / §4.1).
--
-- Display Name is required; the parent/tutor intent pills become OPTIONAL
-- with a Skip allowed. complete_onboarding grows an optional _display_name
-- and accepts a NULL _choice, which records onboarding WITHOUT adding a role
-- or touching active_role — resolveActiveRole() already falls back to held
-- roles when profiles.active_role is NULL, so a skipped user keeps the
-- pre-#459 default (tutor if held, else parent) instead of being pinned.

CREATE OR REPLACE FUNCTION public.complete_onboarding(
  _choice TEXT,
  _display_name TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _name TEXT := NULLIF(btrim(COALESCE(_display_name, '')), '');
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _name IS NOT NULL AND char_length(_name) > 80 THEN
    RAISE EXCEPTION 'Invalid display name';
  END IF;

  IF _choice IS NOT NULL AND _choice NOT IN ('parent', 'tutor') THEN
    RAISE EXCEPTION 'Invalid onboarding choice';
  END IF;

  -- New signups already hold 'parent' (handle_new_user); choosing tutor
  -- adds 'tutor' alongside it. NULL choice (skip) adds nothing. Admin/
  -- staff/super_admin rows are untouched either way.
  IF _choice = 'tutor' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'tutor')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  UPDATE public.profiles
  SET onboarding_completed_at = now(),
      active_role = COALESCE(_choice::text, active_role),
      display_name = COALESCE(_name, display_name)
  WHERE id = _user_id;
END;
$$;

-- Same lockdown as slice 1 (DEFAULT PRIVILEGES hand PUBLIC an implicit
-- EXECUTE; a REVOKE FROM anon does not remove it).
REVOKE EXECUTE ON FUNCTION public.complete_onboarding(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(TEXT, TEXT) TO authenticated;
