-- Issue #295: reveal a tutor's contact details to admins in the TutorEditor.
--
-- Contact data never lives on public.tutors (that table is anon-readable), so
-- the admin surface resolves it from the two places it actually exists:
--   1. The assigned MatchMax account — auth.users.email + profiles.phone.
--   2. The tutor join application (tutor_applications.data JSONB holds the
--      intake form: name / phone / email).
--
-- There is NO hard link between a tutor card and its application today, and
-- guessing one by name/school is unreliable (display names are MM-Txxx codes;
-- multiple cards share a school). So the link is EXPLICIT: the admin picks the
-- application once in the editor, it is stamped on the application row, and
-- this RPC reads it back. Admin role gate inside the function, same pattern as
-- list_accounts_for_assignment (20260930140000). Not exposed to anon.

-- 1. Explicit link column (nullable until an admin links an application).
ALTER TABLE public.tutor_applications
  ADD COLUMN IF NOT EXISTS linked_tutor_id uuid REFERENCES public.tutors(id)
  ON DELETE SET NULL;

-- 2. Contact reveal RPC: assigned account + explicitly linked application.
CREATE OR REPLACE FUNCTION public.get_tutor_contact_details(_tutor_id uuid)
RETURNS TABLE (
  account_email text,
  account_phone text,
  account_display_name text,
  application_name text,
  application_phone text,
  application_email text,
  application_id uuid,
  application_status text,
  application_created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    (SELECT u.email FROM auth.users u WHERE u.id = t.user_id) AS account_email,
    p.phone AS account_phone,
    p.display_name AS account_display_name,
    a.data ->> 'name' AS application_name,
    a.data ->> 'phone' AS application_phone,
    a.data ->> 'email' AS application_email,
    a.id AS application_id,
    a.status::text AS application_status,
    a.created_at AS application_created_at
  FROM public.tutors t
  LEFT JOIN public.profiles p ON p.id = t.user_id
  LEFT JOIN public.tutor_applications a ON a.linked_tutor_id = t.id
  WHERE t.id = _tutor_id
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
    );
$function$;

REVOKE ALL ON FUNCTION public.get_tutor_contact_details(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_tutor_contact_details(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_tutor_contact_details(uuid) TO authenticated;

-- 3. Application picker data: id + label for the editor dropdown (admin only).
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
  ORDER BY a.created_at DESC
  LIMIT 200;
$function$;

REVOKE ALL ON FUNCTION public.list_tutor_applications_for_linking() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_tutor_applications_for_linking() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_tutor_applications_for_linking() TO authenticated;
