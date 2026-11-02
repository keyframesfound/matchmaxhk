-- #573 / SOP §4: notes reviews can be reported ("Report review"), and a
-- listing with 3 open P1 reports auto-hides (enforced in submitReport).
-- Additive: widens the reports target_type CHECK and the insert policy to
-- the new 'material_review' target; every existing value is kept.

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_target_type_check;
ALTER TABLE public.reports
  ADD CONSTRAINT reports_target_type_check CHECK (target_type IN (
    'tutor_card', 'tutor_photo', 'tutor_introduction', 'material', 'material_review'
  ));

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
      'tutor_card', 'tutor_photo', 'tutor_introduction', 'material', 'material_review'
    )
    AND reason IN (
      'contact_details', 'inappropriate_image', 'copyright', 'fake_credentials',
      'not_as_described', 'harassment', 'spam', 'impersonation', 'other'
    )
    AND (reason <> 'other' OR (note IS NOT NULL AND length(btrim(note)) > 0))
  );

-- Fast count of open reports per listing for the auto-hide rule.
CREATE INDEX IF NOT EXISTS idx_reports_open_target
  ON public.reports (target_type, target_id)
  WHERE status = 'open';
