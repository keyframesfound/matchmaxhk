-- Settings-page account type switcher: lets a signed-in user swap between
-- the two self-serve roles (parent <-> tutor). SECURITY DEFINER because
-- user_roles is SELECT-only for authenticated users. Managed roles
-- (super_admin/admin/staff) are explicitly refused, so internal accounts
-- can never be mutated through this RPC.

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

  DELETE FROM public.user_roles
  WHERE user_id = _user_id AND role <> _role AND role IN ('parent', 'tutor');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.switch_role(public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.switch_role(public.app_role) TO authenticated;
