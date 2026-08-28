DROP POLICY IF EXISTS "Public can read whitelisted settings" ON public.app_settings;

CREATE POLICY "Public can read whitelisted settings"
  ON public.app_settings
  FOR SELECT
  TO anon, authenticated
  USING (
    key IN (
      'brand_name',
      'contact_email',
      'whatsapp_number',
      'whatsapp_template',
      'students_matched',
      'hero_tutor_code',
      'subject_options',
      'popular_subjects',
      'default_tutor_profile_photo_male',
      'default_tutor_profile_photo_female'
    )
  );
