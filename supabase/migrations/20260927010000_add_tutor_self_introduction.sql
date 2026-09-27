-- Issue #119: optional tutor-written "Self-Introduction / 簡介".
-- Tutors draft a multi-paragraph pitch (English, Chinese, or both) in the
-- intake form; the concierge team proofreads it in the admin editor and may
-- strip personal contact info before publishing. The 2,000-character cap is
-- enforced in application/editor validation, not by a DB CHECK, mirroring
-- qualifications_summary.

ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS self_introduction TEXT;

COMMENT ON COLUMN public.tutors.self_introduction IS
  'Tutor-written self-introduction (max 2,000 chars) shown verbatim with preserved line breaks on the public profile; hidden when empty (issue #119).';
