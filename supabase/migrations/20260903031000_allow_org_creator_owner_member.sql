-- Allow the organization creator to insert their own owner membership row
-- (fixes chicken-and-egg: is_org_admin is false before the owner row exists)

DROP POLICY "Org admins can invite members" ON public.organization_members;

CREATE POLICY "Org admins or org creator can add members"
  ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_admin(organization_id)
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id AND o.created_by = auth.uid()
    )
  );
