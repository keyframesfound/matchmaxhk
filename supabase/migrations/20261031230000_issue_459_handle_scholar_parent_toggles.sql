-- Issue #459 slice 10: the last §11 ACs.
--
--   1. profiles.handle (§4.1 / §15.1.1): public @handle, 3–24 [a-z0-9_],
--      stored lowercase, unique. Set at onboarding (required for new
--      signups in the UI) or later from Settings. Existing users stay NULL
--      — we never invent handles (§15.2 step 2).
--   2. complete_onboarding gains _handle. The 2-arg version is DROPPED
--      first so no overload is left behind (slice 5 left one; slice 9
--      cleaned it up).
--   3. students.can_view_schedule / can_manage_billing (§4.4 / §15.3):
--      what the parent keeps after a child claims their profile.
--   4. get_tutor_learning_hours (§4.2 step 4): the tutor's OWN verified
--      learning hours, for the Verified MatchMax Scholar badge (>= 10h).

-- 1. handle -----------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS handle text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_handle_format'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_handle_format
      CHECK (handle IS NULL OR handle ~ '^[a-z0-9_]{3,24}$');
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_handle_ci
  ON public.profiles (lower(handle)) WHERE handle IS NOT NULL;

COMMENT ON COLUMN public.profiles.handle IS
  'Issue #459: public @handle, lowercase [a-z0-9_]{3,24}, unique. NULL until the user picks one.';

-- Shared writer: normalises, validates and maps the unique violation to a
-- stable code the UI can translate. Internal only — no client grant.
CREATE OR REPLACE FUNCTION public.apply_profile_handle(_user_id uuid, _handle text)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _clean text := lower(btrim(COALESCE(_handle, '')));
BEGIN
  _clean := ltrim(_clean, '@');
  IF _clean !~ '^[a-z0-9_]{3,24}$' THEN
    RAISE EXCEPTION 'HANDLE_INVALID';
  END IF;
  BEGIN
    UPDATE public.profiles SET handle = _clean WHERE id = _user_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'HANDLE_TAKEN';
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_profile_handle(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_my_handle(_handle text)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  PERFORM public.apply_profile_handle(auth.uid(), _handle);
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_handle(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_handle(text) TO authenticated;

-- 2. complete_onboarding(_choice, _display_name, _handle) ---------------------
DROP FUNCTION IF EXISTS public.complete_onboarding(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.complete_onboarding(
  _choice TEXT,
  _display_name TEXT DEFAULT NULL,
  _handle TEXT DEFAULT NULL
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

  -- Validate the handle before any write so a taken handle leaves the
  -- user un-onboarded and able to retry.
  IF NULLIF(btrim(COALESCE(_handle, '')), '') IS NOT NULL THEN
    PERFORM public.apply_profile_handle(_user_id, _handle);
  END IF;

  -- Additive only (slice 1): tutor is added alongside parent, never swapped.
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

REVOKE EXECUTE ON FUNCTION public.complete_onboarding(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(TEXT, TEXT, TEXT) TO authenticated;

-- 3. parent retain toggles ----------------------------------------------------
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS can_view_schedule boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_manage_billing boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.students.can_view_schedule IS
  'Issue #459: after a claim, whether the parent still sees this child''s lessons. Parent-set preference.';
COMMENT ON COLUMN public.students.can_manage_billing IS
  'Issue #459: after a claim, whether the parent still pays for this child''s lessons. Parent-set preference.';

-- 4. tutor's own learning hours (Scholar badge) -------------------------------
-- Learning rows that belong to the tutor's own account: a claimed profile
-- they now own, or a self-booked case ("Myself"). Never rows they taught.
CREATE OR REPLACE FUNCTION public.get_tutor_learning_hours(_tutor_id uuid)
RETURNS numeric(10,2)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
STABLE
AS $function$
  SELECT COALESCE(sum(l.duration_hours), 0)::numeric(10,2)
  FROM public.tutors t
  JOIN public.verified_hours_ledger l ON l.status = 'verified_completed'
  LEFT JOIN public.students s ON s.id = l.student_id
  LEFT JOIN public.tutoring_cases c ON c.id = l.case_id
  WHERE t.id = _tutor_id
    AND t.user_id IS NOT NULL
    AND l.tutor_id IS DISTINCT FROM _tutor_id
    AND (
      s.owner_user_id = t.user_id
      OR (l.student_id IS NULL AND c.parent_id = t.user_id AND c.who_for = 'myself')
    );
$function$;

GRANT EXECUTE ON FUNCTION public.get_tutor_learning_hours(uuid) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_tutor_learning_hours(uuid) FROM PUBLIC;

-- 5. /account "Who is learning?" pills read tutoring_cases.student_id from
-- the client (row access is still the existing parent RLS). The id points
-- at service-role-only public.students, so it reveals nothing on its own.
GRANT SELECT (student_id) ON public.tutoring_cases TO authenticated;
