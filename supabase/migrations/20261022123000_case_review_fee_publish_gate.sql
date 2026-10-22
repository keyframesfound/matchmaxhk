-- Issue #386 — publish gate for parent→tutor case reviews (lazy, on read).
--
-- TS half (shipped in the same PR): submitParentReview holds every parent→tutor
-- review under held_reason = 'pending_fee_settlement' while the case's
-- applicable admin fee is unsettled, and getParentCaseDetail lazily flips
-- eligible held rows to visible on read once the fee settles.
--
-- This migration is the second read path: the tutor profile's review summary.
-- src/routes/tutors.$tutorCode.tsx reads it via the anon RPC
-- get_tutor_review_summary (no server fn in between), so the lazy publish has
-- to live inside the RPC itself.
--
-- Settled rule (matches src/features/cases/case-reviews.ts, the single source):
-- sor_status IN ('fee_paid','active','replaced','waived') — the states
-- reachable ONLY through fee settlement (fee_paid → active is the sole path to
-- active; replaced only from active; waived = settled by waiver). 'closed' is
-- excluded: it is reachable from pre-fee states, so it is not proof of
-- settlement. The 1.0x (L1-terminated) vs 1.5x (L2-completed) refinement from
-- #385 is a documented future refinement, not built here.
--
-- Only rows held PURELY for the fee settlement flip; a contact-hold
-- (phone/email/WhatsApp, reason 'held: …') never auto-publishes (#205).
--
-- Volatility moves STABLE → VOLATILE because the function now writes on read.

CREATE OR REPLACE FUNCTION public.get_tutor_review_summary(_tutor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.case_reviews r
  SET status = 'visible', updated_at = now()
  FROM public.tutoring_cases c
  WHERE r.case_id = c.id
    AND r.tutor_id = _tutor_id
    AND r.direction = 'parent_to_tutor'
    AND r.status = 'held'
    AND r.held_reason = 'pending_fee_settlement'
    AND c.sor_status IN ('fee_paid', 'active', 'replaced', 'waived');

  RETURN (
    SELECT jsonb_build_object(
      'average', (SELECT round(avg(rating)::numeric, 1) FROM public.case_reviews
                  WHERE tutor_id = _tutor_id AND direction = 'parent_to_tutor' AND status = 'visible'),
      'count', (SELECT count(*) FROM public.case_reviews
                WHERE tutor_id = _tutor_id AND direction = 'parent_to_tutor' AND status = 'visible'),
      'latest', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                    'rating', r.rating, 'comment', r.comment,
                    'display_line', r.author_display_line, 'created_at', r.created_at)), '[]'::jsonb)
                 FROM (SELECT rating, comment, author_display_line, created_at
                       FROM public.case_reviews
                       WHERE tutor_id = _tutor_id AND direction = 'parent_to_tutor' AND status = 'visible'
                       ORDER BY created_at DESC LIMIT 5) r)
    );
  );
END;
$function$;

-- CREATE OR REPLACE keeps the existing grants; re-asserted for clarity/idempotence.
GRANT EXECUTE ON FUNCTION public.get_tutor_review_summary(uuid) TO anon, authenticated;
