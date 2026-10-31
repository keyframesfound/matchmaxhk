-- Security fix: list_tutor_applications_for_linking (20261010000000, #295)
-- was documented "admin only" but had no caller check. It is SECURITY
-- DEFINER and granted to `authenticated`, so any signed-in parent or tutor
-- could call /rest/v1/rpc/list_tutor_applications_for_linking and read the
-- name + email + date of the newest 200 tutor applicants.
--
-- Fix: the same admin / super_admin filter its sibling
-- get_tutor_contact_details already applies. Non-admins now get zero rows.
-- The only caller is the admin TutorEditor contact-details picker.

CREATE OR REPLACE FUNCTION public.list_tutor_applications_for_linking()
RETURNS TABLE (id uuid, label text, status text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    a.id,
    concat_ws(
      ' · ',
      a.data ->> 'name',
      a.data ->> 'email',
      to_char(a.created_at, 'YYYY-MM-DD')
    ) AS label,
    a.status::text AS status,
    a.created_at
  FROM public.tutor_applications a
  WHERE public.has_role(auth.uid(), 'admin')
     OR public.has_role(auth.uid(), 'super_admin')
  ORDER BY a.created_at DESC
  LIMIT 200;
$function$;

REVOKE ALL ON FUNCTION public.list_tutor_applications_for_linking() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_tutor_applications_for_linking() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_tutor_applications_for_linking() TO authenticated;
