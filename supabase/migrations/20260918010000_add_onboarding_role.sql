-- First-signin onboarding: records when a user completed the "What brings
-- you to MatchMax?" role-selection dialog, and lets them self-claim the
-- tutor role through a SECURITY DEFINER RPC (user_roles is SELECT-only for
-- authenticated users; only admins write roles directly, so this narrow
-- RPC is the one sanctioned self-service path).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.onboarding_completed_at IS 'When the user completed the first-signin onboarding role selection.';

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

  -- Self-serve role claim: new signups default to 'parent'; choosing tutor
  -- swaps it for 'tutor'. Admin/staff/super_admin rows are never touched.
  IF _choice = 'tutor' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'tutor')
    ON CONFLICT (user_id, role) DO NOTHING;

    DELETE FROM public.user_roles
    WHERE user_id = _user_id AND role = 'parent';
  END IF;

  UPDATE public.profiles
  SET onboarding_completed_at = now()
  WHERE id = _user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_onboarding(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(TEXT) TO authenticated;
