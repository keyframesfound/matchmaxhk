DROP POLICY "Public can read whitelisted settings" ON public.app_settings;
CREATE POLICY "Public can read whitelisted settings" ON public.app_settings
FOR SELECT USING (key = ANY (ARRAY['brand_name'::text, 'contact_email'::text, 'whatsapp_number'::text, 'whatsapp_template'::text, 'students_matched'::text, 'hero_tutor_code'::text, 'subject_options'::text, 'popular_subjects'::text]));