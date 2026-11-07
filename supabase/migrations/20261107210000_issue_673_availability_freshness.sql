-- Issue #673 — 14-day availability freshness + Profile Strength basis.
--
-- tutors.availability_confirmed_at: stamped by the 1-tap "Confirm schedule is
-- up to date" action (self-serve RPC below) and by the availability editors.
-- The pure rule (availability-freshness.ts) deducts 15 Profile-Strength
-- points while now − confirmed_at > 14 days; no automated demotion.

ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS availability_confirmed_at timestamptz;

COMMENT ON COLUMN public.tutors.availability_confirmed_at IS
  '#673: last 1-tap confirmation that the weekly availability grid is still current. 14-day staleness rule lives in the app.';

-- Self-serve SECURITY DEFINER: the tutor can only stamp their OWN row, and
-- only when their account actually owns a tutor card.
CREATE OR REPLACE FUNCTION public.confirm_my_availability_fresh()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  UPDATE public.tutors
  SET availability_confirmed_at = now()
  WHERE user_id = v_user;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_TUTOR_CARD';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_my_availability_fresh() FROM anon;
GRANT EXECUTE ON FUNCTION public.confirm_my_availability_fresh() TO authenticated;
