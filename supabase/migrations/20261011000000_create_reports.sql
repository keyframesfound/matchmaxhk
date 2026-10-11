-- Issue #216: Report button — one report form for a tutor card, a photo, an
-- introduction, and a note (digital_materials listing). The reporter picks a
-- reason; staff work a queue; the reported tutor is never told who reported.
--
-- Trust model (follows the repo's settled patterns):
--   * One OPEN report per (reporter, target) — enforced by a partial UNIQUE
--     index, so "two reports on the same photo do not create two open rows"
--     per the acceptance criteria (a second report by the SAME person is
--     blocked while one is open; different reporters are fine and wanted).
--   * reporter_id is auth-scoped by RLS (authenticated insert, own rows only)
--     and NEVER readable by the reported party: the tutor-facing read path
--     doesn't exist at all. Admin queue reads via has_role RLS policies.
--   * Targets are soft references (uuid + target_type), because a report may
--     name a photo/introduction (part of the tutors row) OR a whole card OR a
--     digital_materials listing. No FK to keep reports alive after deletion —
--     moderation history outlives the content.
--   * Status lifecycle: open -> upheld | rejected (staff action, admin UI).

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who reported (authenticated users only; the form requires a login).
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What is reported. target_type: 'tutor_card' | 'tutor_photo' |
  -- 'tutor_introduction' | 'material'. target_id is the tutors.id or
  -- digital_materials.id as appropriate (not FK-enforced on purpose).
  target_type TEXT NOT NULL CHECK (target_type IN (
    'tutor_card', 'tutor_photo', 'tutor_introduction', 'material'
  )),
  target_id UUID NOT NULL,

  -- The tutor who owns the reported content — denormalised for the "second
  -- upheld report pauses the card" rule and the queue's tutor grouping.
  -- Nullable: a material's tutor may be gone while the report survives.
  tutor_id UUID REFERENCES public.tutors(id) ON DELETE SET NULL,

  reason TEXT NOT NULL CHECK (reason IN (
    'contact_details',
    'inappropriate_image',
    'copyright',
    'fake_credentials',
    'not_as_described',
    'harassment',
    'spam',
    'impersonation',
    'other'
  )),
  -- Required when reason = 'other' (validated in the app schemas too).
  note TEXT,

  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'upheld', 'rejected')),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The one-open-report-per-item gate: at most one OPEN row per reporter
-- per target, regardless of resolved history.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_one_open_per_reporter_target
  ON public.reports (reporter_id, target_type, target_id)
  WHERE status = 'open';

-- Queue reads: open first, oldest last.
CREATE INDEX IF NOT EXISTS idx_reports_queue
  ON public.reports (status, created_at DESC);
-- "A second upheld report on the same tutor pauses the card" — counted here.
CREATE INDEX IF NOT EXISTS idx_reports_tutor_upheld
  ON public.reports (tutor_id)
  WHERE status = 'upheld';

COMMENT ON TABLE public.reports IS
  'Issue #216: user reports on tutor cards/photos/introductions and material listings. Reporter identity is never exposed to the reported party (no tutor-facing SELECT policy). Staff act in an admin queue: open -> upheld/rejected. A second upheld report on the same tutor pauses the card (application-level rule).';

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Reporters may see only their own submissions (so the form can show "already
-- reported" state) — the reported tutor has NO read path on reports naming them.
CREATE POLICY "Users can read own reports"
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Users can submit reports"
  ON public.reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = reporter_id
    AND target_type IN (
      'tutor_card', 'tutor_photo', 'tutor_introduction', 'material'
    )
    AND reason IN (
      'contact_details', 'inappropriate_image', 'copyright', 'fake_credentials',
      'not_as_described', 'harassment', 'spam', 'impersonation', 'other'
    )
    AND (reason <> 'other' OR (note IS NOT NULL AND length(btrim(note)) > 0))
  );

-- Nobody updates/deletes via the client: the admin queue acts through an
-- admin-gated server function (service role). No UPDATE/DELETE policies.
GRANT SELECT, INSERT ON public.reports TO authenticated;
REVOKE ALL ON public.reports FROM anon;
GRANT ALL ON public.reports TO service_role;
