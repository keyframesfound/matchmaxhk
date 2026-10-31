-- Issue #459 slice 4: parent hours review + public verified-hours counters.
--
-- The ledger table + trigger writer landed in 20261031160000; rows reach
-- verified through the parent confirm/dispute server fns
-- (src/features/hours/hours.functions.ts, service-role) or the 24h cron.
-- This migration only adds the read-only public counters:
--
--   get_tutor_verified_hours   — anon-readable, powers the tutor profile
--                                hours line + Rising/Azure badges (§15.8).
--   get_my_verified_learning_hours — self-only; the family's total verified
--                                learning hours on /account (children are
--                                summed, never split to other accounts).
--
-- Same shape as the #503 aggregates (20261028120000): SQL, SECURITY DEFINER,
-- STABLE, EXECUTE granted deliberately, PUBLIC revoked explicitly (DEFAULT
-- PRIVILEGES hand PUBLIC an implicit EXECUTE that a REVOKE FROM anon does
-- not remove).

CREATE OR REPLACE FUNCTION public.get_tutor_verified_hours(_tutor_id uuid)
RETURNS numeric(10,2)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
STABLE
AS $function$
  SELECT COALESCE(sum(duration_hours), 0)::numeric(10,2)
  FROM public.verified_hours_ledger
  WHERE tutor_id = _tutor_id
    AND status = 'verified_completed';
$function$;

CREATE OR REPLACE FUNCTION public.get_my_verified_learning_hours()
RETURNS numeric(10,2)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
STABLE
AS $function$
  SELECT COALESCE(sum(l.duration_hours), 0)::numeric(10,2)
  FROM public.verified_hours_ledger l
  JOIN public.students s ON s.id = l.student_id
  WHERE s.parent_user_id = auth.uid()
    AND l.status = 'verified_completed';
$function$;

-- Read-only aggregates: the get_tutor_review_summary precedent. Tutor-side
-- is a public profile number (same audience as
-- get_tutor_completed_case_count); learning-hours stays self-only so a
-- family's child hours never leak to other accounts.
GRANT EXECUTE ON FUNCTION public.get_tutor_verified_hours(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_verified_learning_hours() TO authenticated;
REVOKE ALL ON FUNCTION public.get_my_verified_learning_hours() FROM anon;

REVOKE ALL ON FUNCTION public.get_my_verified_learning_hours() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_tutor_verified_hours(uuid) FROM PUBLIC;
