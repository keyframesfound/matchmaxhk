-- Issue #503 — bilateral End Case + case-rating edit lock.
--
-- Case ratings (#205/#287/#386) stay editable while a case is ongoing and
-- freeze when the case ENDS. Ending is bilateral: parent and tutor each tap
-- End Case on their own surface; the case becomes Ended when BOTH sides have
-- tapped (or staff force-ends from the existing SoR desk, which can already
-- transition any legal state to 'closed').
--
-- Ended state = the EXISTING sor_status 'closed' (the issue's eng note: point
-- End Case at the current closed/replaced vocabulary when one fits; 'closed'
-- is the terminal completed-case state and #459 can treat it as completed).
-- No new status is added.
--
-- 1. Per-side end markers on the case. Plain timestamps written service-role
--    from the endCase server fn; parents/tutors cannot write them directly
--    (owner writes were frozen in 20261017170000, and these columns are
--    deliberately NOT granted to authenticated — every read path is a
--    service-role server fn, fail-closed by default per that migration's
--    "future columns are NOT readable until granted" rule).
ALTER TABLE public.tutoring_cases
  ADD COLUMN IF NOT EXISTS ended_by_parent_at timestamptz;
ALTER TABLE public.tutoring_cases
  ADD COLUMN IF NOT EXISTS ended_by_tutor_at timestamptz;

COMMENT ON COLUMN public.tutoring_cases.ended_by_parent_at IS
  '#503: when the parent tapped End Case ("I consider this case finished"). Both sides set + staff-or-either completes the case to sor_status ''closed''.';
COMMENT ON COLUMN public.tutoring_cases.ended_by_tutor_at IS
  '#503: when the tutor tapped End Case. See ended_by_parent_at.';

-- 2. Transition guard: End Case must be able to close an ONGOING post-fee
--    case. Live cases sit at 'fee_paid' (nothing auto-flips fee_paid→active;
--    only the desk does), so 'fee_paid->closed' joins the allowed edges —
--    otherwise the bilateral End Case could never fire on real cases. The
--    guard's privileged NULL-adopt branch from 20261017170000 is preserved
--    verbatim; this re-emission only adds the one edge.
CREATE OR REPLACE FUNCTION public.sor_case_transition_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  _allowed text[] := ARRAY[
    'draft->introduced', 'draft->closed',
    'introduced->lesson_1_scheduled', 'introduced->closed',
    'lesson_1_scheduled->lesson_1_done', 'lesson_1_scheduled->closed',
    'lesson_1_done->lesson_2_scheduled', 'lesson_1_done->fee_invoiced', 'lesson_1_done->closed',
    'lesson_2_scheduled->lesson_2_done', 'lesson_2_scheduled->closed',
    'lesson_2_done->fee_invoiced',
    'fee_invoiced->fee_paid', 'fee_invoiced->waived',
    'fee_paid->active', 'fee_paid->closed',
    'active->replaced', 'active->closed',
    'waived->closed'
  ];
  _claim text;
  _privileged boolean;
BEGIN
  IF NEW.sor_status IS NULL OR NEW.sor_status = OLD.sor_status THEN
    RETURN NEW;
  END IF;
  IF OLD.sor_status IS NULL THEN
    -- NULL → status adopt is a SoR onboarding act: admins/staff (browser) or
    -- service_role (server fns) only. Non-PostgREST contexts (migrations, SQL
    -- editor) have no request.jwt.claim.role and are treated as trusted.
    _claim := current_setting('request.jwt.claim.role', true);
    _privileged := _claim IS NULL
      OR _claim = 'service_role'
      OR (
        auth.uid() IS NOT NULL
        AND (
          public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'super_admin')
          OR public.has_role(auth.uid(), 'staff')
        )
      );
    IF NOT _privileged THEN
      RAISE EXCEPTION 'sor_status adopt requires admin or service role'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;
  IF NOT (OLD.sor_status || '->' || NEW.sor_status) = ANY (_allowed) THEN
    RAISE EXCEPTION 'illegal case status transition % -> %', OLD.sor_status, NEW.sor_status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Completed-case counts for the profile surfaces (#503 minimal slice of
--    #459: ended cases recorded + countable; the hours ledger itself stays
--    #459's). A case COUNTS as completed when it is closed AND its applicable
--    admin fee was settled — the same settled proof the #386 publish gate uses
--    (a paid/waived case_fees row persists after closure, while pre-fee
--    desk closures of abandoned requests stay uncounted).
--
--    Tutor side is anon-readable (public profile line, same audience as
--    get_tutor_review_summary). Parent side is self-only (auth.uid()), so a
--    parent's completion count never leaks to other accounts.

CREATE OR REPLACE FUNCTION public.get_tutor_completed_case_count(_tutor_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
STABLE
AS $function$
  SELECT count(*)::integer
  FROM public.tutoring_cases c
  WHERE c.matched_tutor_id = _tutor_id
    AND c.sor_status = 'closed'
    AND EXISTS (
      SELECT 1 FROM public.case_fees f
      WHERE f.case_id = c.id AND f.status IN ('paid', 'waived')
    );
$function$;

CREATE OR REPLACE FUNCTION public.get_my_completed_case_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
STABLE
AS $function$
  SELECT count(*)::integer
  FROM public.tutoring_cases c
  WHERE c.parent_id = auth.uid()
    AND c.sor_status = 'closed'
    AND EXISTS (
      SELECT 1 FROM public.case_fees f
      WHERE f.case_id = c.id AND f.status IN ('paid', 'waived')
    );
$function$;

-- Read-only aggregates: anon/authenticated EXECUTE is intended (the
-- get_tutor_review_summary precedent). No mutating functions were added, so
-- no hardening REVOKE is required; trigger functions keep their existing
-- lockdown (re-emitted CREATE OR REPLACE preserves ownership, and the 2026-
-- 10-17 revocations still apply to the same function name).
GRANT EXECUTE ON FUNCTION public.get_tutor_completed_case_count(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_completed_case_count() TO authenticated;
REVOKE ALL ON FUNCTION public.get_my_completed_case_count() FROM anon;
