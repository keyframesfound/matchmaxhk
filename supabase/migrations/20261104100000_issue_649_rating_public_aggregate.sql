-- Issue #649 — Parent → Tutor ratings after lesson N (Trust).
--
-- Pure re-assertion on top of the closed #205/#287/#503/#386 case_reviews
-- product: no new tables, no new columns. Two changes only.
--
-- 1. CEO LOCK threshold = 3 public-aggregate packaging. The RPC now returns
--    `average` ONLY as a real average of published (status='visible')
--    parent→tutor reviews — hidden reviews (staff-moderated, status
--    'hidden') and contact/fee-held rows never enter the average or the
--    count. The display threshold itself lives in TS
--    (RATING_PUBLIC_THRESHOLD in src/features/cases/case-reviews.ts):
--    count 0 → "New" (never 0.0), 1–2 → count-only, ≥3 → average + count.
--
-- 2. CEO LOCK N = 2 lazy-publish gate. The lazy flip (held → visible on
--    read) now requires BOTH #386 fee settlement AND two eligible lessons
--    (status 'confirmed'|'done' with BOTH confirm columns set — the same
--    #503 dual-confirm predicate as TS parentCanReviewCase; the Attendance /
--    desk-confirmed variant arrives with #612). Pure hold reasons that flip:
--    'pending_fee_settlement' (#386) and the new 'pending_lesson_threshold'
--    (fee settled on a short case but lesson 2 not done yet — written by
--    decideReviewSubmit). A contact hold ('held: …', or a combined
--    'X + held: …') NEVER auto-publishes (#205).
--
-- SoT locks untouched: Cap.57, tutor-pays 1.5 / short-case, no Stripe refund
-- automation, no parent-pays commission. Materials review tables (#273/#556)
-- are NOT touched — this only redefines the existing case_reviews summary.

CREATE OR REPLACE FUNCTION public.get_tutor_review_summary(_tutor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
VOLATILE
AS $function$
BEGIN
  -- Lazy publish (issue #386 + #649): flip held parent→tutor reviews to
  -- visible once the case's applicable admin fee is settled AND the case has
  -- reached lesson N = 2 (CEO LOCK). Only PURE holds flip; a contact hold
  -- (combined 'X + held: …') never auto-publishes.
  UPDATE public.case_reviews r
  SET status = 'visible', updated_at = now()
  FROM public.tutoring_cases c
  WHERE r.case_id = c.id
    AND r.tutor_id = _tutor_id
    AND r.direction = 'parent_to_tutor'
    AND r.status = 'held'
    AND r.held_reason IN ('pending_fee_settlement', 'pending_lesson_threshold')
    AND (
      -- #386 settled rule: sor_status reachable ONLY through fee settlement,
      -- OR a case_fees row with status 'paid'/'waived' (direct proof; covers
      -- cases closed AFTER settlement).
      c.sor_status IN ('fee_paid', 'active', 'replaced', 'waived')
      OR EXISTS (
        SELECT 1 FROM public.case_fees f
        WHERE f.case_id = c.id AND f.status IN ('paid', 'waived')
      )
    )
    AND (
      -- #649 CEO LOCK N = 2: two bilaterally confirmed/done lessons (#503
      -- predicate, mirrors parentCanReviewCase in case-reviews.ts).
      SELECT count(*) FROM public.case_lessons l
      WHERE l.case_id = c.id
        AND l.status IN ('confirmed', 'done')
        AND l.confirmed_by_parent_at IS NOT NULL
        AND l.confirmed_by_tutor_at IS NOT NULL
    ) >= 2;

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
    )
  );
END;
$function$;

-- CREATE OR REPLACE keeps the existing grants; re-asserted for clarity/idempotence.
GRANT EXECUTE ON FUNCTION public.get_tutor_review_summary(uuid) TO anon, authenticated;
