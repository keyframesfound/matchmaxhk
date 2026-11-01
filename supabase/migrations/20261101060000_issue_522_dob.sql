-- Issue #522: DOB / age on Google sign-up (HK contractual capacity + PDPO).
--
--   profiles += date_of_birth / show_birthday_public (🎂 month-day only,
--   never the year, logged-in viewers only) / parent_guardian_contact
--   (under-13 account link) / parental_awareness_confirmed_at (under-18
--   checkbox).
--
--   complete_onboarding gains optional DOB params (additive signature).
--   Age tiers (#522 §3): <13 → Learning sub-profile path, 13–15 blocked
--   from the tutor role, 16–17 allowed with the parental awareness
--   checkbox, ≥18 full. A missing DOB never blocks (legacy users).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date CHECK (date_of_birth IS NULL OR date_of_birth <= CURRENT_DATE),
  ADD COLUMN IF NOT EXISTS show_birthday_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_guardian_contact text
    CHECK (parent_guardian_contact IS NULL OR char_length(parent_guardian_contact) <= 120),
  ADD COLUMN IF NOT EXISTS parental_awareness_confirmed_at timestamptz;

COMMENT ON COLUMN public.profiles.date_of_birth IS
  'Issue #522: strictly private birth year. Used for age tiers + optional month/day badge; never public, never in unauthenticated output.';
COMMENT ON COLUMN public.profiles.show_birthday_public IS
  'Issue #522: opt-in Facebook-style badge showing month + day only, to logged-in users. Year/age never exposed.';

-- Shared tier helper (STABLE, SECURITY DEFINER so RPCs and server fns can
-- gate consistently): null when no DOB on file.
CREATE OR REPLACE FUNCTION public.age_tier(_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
STABLE
AS $$
  SELECT CASE
    WHEN p.date_of_birth IS NULL THEN NULL
    WHEN date_part('year', age(p.date_of_birth)) >= 18 THEN 'adult'
    WHEN date_part('year', age(p.date_of_birth)) >= 16 THEN 'teen_16_17'
    WHEN date_part('year', age(p.date_of_birth)) >= 13 THEN 'teen_13_15'
    ELSE 'child'
  END
  FROM public.profiles p
  WHERE p.id = _user_id;
$$;

REVOKE ALL ON FUNCTION public.age_tier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.age_tier(uuid) TO authenticated, service_role;

-- Extended onboarding save (additive: older 1/2/3-arg callers keep working).
CREATE OR REPLACE FUNCTION public.complete_onboarding(
  _choice TEXT,
  _display_name TEXT DEFAULT NULL,
  _handle TEXT DEFAULT NULL,
  _date_of_birth DATE DEFAULT NULL,
  _show_birthday_public BOOLEAN DEFAULT FALSE,
  _parent_guardian_contact TEXT DEFAULT NULL
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
  _contact TEXT := NULLIF(btrim(COALESCE(_parent_guardian_contact, '')), '');
  _dob DATE := _date_of_birth;
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

  IF _dob IS NOT NULL AND _dob > CURRENT_DATE THEN
    RAISE EXCEPTION 'Invalid date of birth';
  END IF;

  -- #522 tier 4: under-13 cannot activate Teaching.
  IF _choice = 'tutor' AND _dob IS NOT NULL
     AND date_part('year', age(_dob)) < 16 THEN
    RAISE EXCEPTION 'AGE_RESTRICTED';
  END IF;

  IF _contact IS NOT NULL AND char_length(_contact) > 120 THEN
    RAISE EXCEPTION 'Invalid parent contact';
  END IF;

  IF NULLIF(btrim(COALESCE(_handle, '')), '') IS NOT NULL THEN
    PERFORM public.apply_profile_handle(_user_id, _handle);
  END IF;

  IF _choice = 'tutor' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'tutor')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  UPDATE public.profiles
  SET onboarding_completed_at = now(),
      active_role = COALESCE(_choice::text, active_role),
      display_name = COALESCE(_name, display_name),
      date_of_birth = COALESCE(_dob, date_of_birth),
      show_birthday_public = COALESCE(_show_birthday_public, show_birthday_public),
      parent_guardian_contact = COALESCE(_contact, parent_guardian_contact),
      -- The under-18 checkbox is confirmed in-app; server just stamps the
      -- consent moment when a DOB below 18 is on file.
      parental_awareness_confirmed_at = CASE
        WHEN _dob IS NOT NULL AND date_part('year', age(_dob)) < 18 THEN now()
        ELSE parental_awareness_confirmed_at
      END
  WHERE id = _user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_onboarding(TEXT, TEXT, TEXT, DATE, BOOLEAN, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(TEXT, TEXT, TEXT, DATE, BOOLEAN, TEXT)
  TO authenticated;
