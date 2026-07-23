
-- Restrict has_role EXECUTE to authenticated only (used by RLS as the querying role)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Restrict handle_new_user (auth trigger) - not meant to be called via API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- update_updated_at_column is a trigger fn; revoke direct execute
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Restrict app_settings public read to specific safe keys only
DROP POLICY IF EXISTS "Anyone can read settings" ON public.app_settings;

CREATE POLICY "Public can read whitelisted settings"
  ON public.app_settings
  FOR SELECT
  TO anon, authenticated
  USING (key IN ('brand_name', 'contact_email', 'whatsapp_number', 'whatsapp_template'));
