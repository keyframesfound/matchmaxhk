-- Issue #428 Phase 1: Outcome Event Ledger (append-only funnel events).
--
-- Collects what ALREADY happens in the flow — no new product surfaces, no
-- ranking, no ML (Phase 2 explainable ranking waits for the #454 cockpit;
-- Phase 3 stays parked). Privacy: case/tutor/client ids only, free-text
-- stays out of metadata; staff-gated surfaces write through server fns.
--
-- Posture: RLS on, zero client grants. Append-only is enforced by grants:
-- service_role gets INSERT + SELECT only — no UPDATE, no DELETE.

CREATE TABLE IF NOT EXISTS public.case_funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.tutoring_cases(id) ON DELETE CASCADE,
  tutor_id uuid REFERENCES public.tutors(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'tutor_profile_viewed', 'tutor_requested',
    'recommendation_used', 'tutor_pinged',
    'tutor_replied_yes', 'tutor_replied_no',
    'parent_approved_ok', 'intro_group_opened',
    'lesson_1_confirmed', 'lesson_2_confirmed',
    'fee_invoiced', 'fee_marked_paid',
    'case_stopped_early', 'case_rematch_requested',
    'verified_review_published', 'notes_or_shop_purchase',
    'session_logged'
  )),
  -- #428: parent_clicked_specific | staff_shortlist
  request_source text CHECK (request_source IS NULL OR request_source IN ('parent_clicked_specific', 'staff_shortlist')),
  rank_position integer CHECK (rank_position IS NULL OR rank_position >= 1),
  stop_reason text CHECK (stop_reason IS NULL OR stop_reason IN (
    'schedule_mismatch', 'rate_mismatch', 'teaching_style',
    'tutor_unresponsive', 'parent_ghosted', 'other'
  )),
  -- 1-tap calendar chip (#428 §1.2), non-blocking.
  session_focus text CHECK (session_focus IS NULL OR session_focus IN (
    'Concept Building', 'Past Paper', 'IA/EE/SBA', 'Homework', 'Skill Practice'
  )),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_funnel_events_case
  ON public.case_funnel_events (case_id, created_at);
CREATE INDEX IF NOT EXISTS idx_case_funnel_events_tutor
  ON public.case_funnel_events (tutor_id, event_type)
  WHERE tutor_id IS NOT NULL;

ALTER TABLE public.case_funnel_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.case_funnel_events FROM anon, authenticated;
GRANT INSERT, SELECT ON public.case_funnel_events TO service_role;

COMMENT ON TABLE public.case_funnel_events IS
  'Issue #428 Phase 1: append-only outcome ledger. INSERT+SELECT for service_role only — rows are immutable. Phase 2 ranking reads this; nothing here ranks anything.';
