-- Issue #160: tutors edit their own assigned profile (GitHub-style assignee).
--
-- Admins already link a MatchMax account to a tutor card via tutors.user_id
-- (set in the editor's Assigned account section). Until now a linked tutor
-- could only read their card (tutors_owner_select) and self-serve availability
-- through RPCs. This migration lets the assigned account UPDATE its own row
-- directly, so the "My tutor profile" settings section can save every field
-- live with no admin review cycle (Ryan's explicit choice).
--
-- Guardrails kept despite full edit:
--   * WITH CHECK pins user_id to the caller — an assigned tutor can never
--     unassign their card or reassign it to someone else's account.
--   * Crucial field flags (tutor_field_flags, admin-only) still force the
--     profile out of the public directory at read time — unchanged here.
--   * INSERT/DELETE stay admin-only; tutors edit, they don't create or remove
--     cards.

CREATE POLICY "tutors_owner_update" ON public.tutors
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin-only account search for the editor's assignee dropdown. Reads
-- auth.users (not exposed to clients), so SECURITY DEFINER with an explicit
-- admin gate — same pattern as find_user_id_by_email (issue #127).
CREATE OR REPLACE FUNCTION public.list_accounts_for_assignment(_search text)
RETURNS TABLE (id uuid, email text, display_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    u.id,
    u.email,
    p.display_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE
    (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
    )
    AND NULLIF(btrim(_search), '') IS NOT NULL
    AND (
      u.email ILIKE '%' || btrim(_search) || '%'
      OR p.display_name ILIKE '%' || btrim(_search) || '%'
    )
  ORDER BY p.display_name NULLS LAST, u.email
  LIMIT 10;
$function$;

REVOKE ALL ON FUNCTION public.list_accounts_for_assignment(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_accounts_for_assignment(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_accounts_for_assignment(text) TO authenticated;
