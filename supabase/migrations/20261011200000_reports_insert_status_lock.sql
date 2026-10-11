-- Issue #216 repair (post-review blocker 1): the INSERT policy on
-- public.reports validated reporter/reason/target/note but NOT status or
-- resolved_at, so an authenticated client hitting PostgREST directly could
-- insert `status = 'upheld'` (with a fabricated resolved_at) and bypass staff
-- review entirely — poisoning the admin queue and the second-upheld pause
-- rule. The original migration is already applied live, so this ships as a
-- repair migration rather than editing 20261011000000 in place.
--
-- submitReport (server fn) always inserts status = 'open' / resolved_at =
-- NULL, so the tightened WITH CHECK cannot reject the legitimate path.

DROP POLICY IF EXISTS "Users can submit reports" ON public.reports;

CREATE POLICY "Users can submit reports"
  ON public.reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = reporter_id
    AND status = 'open'
    AND resolved_at IS NULL
    AND target_type IN (
      'tutor_card', 'tutor_photo', 'tutor_introduction', 'material'
    )
    AND reason IN (
      'contact_details', 'inappropriate_image', 'copyright', 'fake_credentials',
      'not_as_described', 'harassment', 'spam', 'impersonation', 'other'
    )
    AND (reason <> 'other' OR (note IS NOT NULL AND length(btrim(note)) > 0))
  );
