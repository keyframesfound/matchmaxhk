-- Issue #438 — V1 manual P1–P4 triage desk + fast-responder flag.
--
-- Buildable V1 slice only: humans set priority manually; the automated
-- WhatsApp greeting (WA Business API webhook) is DEFERRED until WA
-- Business API access exists — no webhook infrastructure is created here.
--
-- 1. tutoring_cases.priority_tier — manual desk priority. text + CHECK
--    (not enum) to match who_for/student_gender (#437) and keep prod enum
--    drift out of the critical path. NOT NULL DEFAULT 'UNASSIGNED' so the
--    desk split needs no backfill: every existing row lands on the Active
--    Desk until an agent triages it.
--    Desk buckets (CEO lock): Active Desk = UNASSIGNED + P1 + P2,
--    Hold/Review = P3 + P4. Insert-only quick replies and the dropdown are
--    client-side; no LLM, nothing auto-sends.
-- 2. tutors.is_fast_responder — MANUAL admin toggle for V1 (the ⚡ badge
--    consumer, the #428 Top-8 shortlist UI, does not exist yet; deferred
--    there). tutors already carries table-level SELECT grants for
--    anon/authenticated, so the new column is readable without a grant.
-- 3. tutoring_cases SELECT stays COLUMN-LEVEL for authenticated (see
--    20261017170000 BE2): new columns are NOT readable until granted, so
--    priority_tier gets an additive column grant. A plain GRANT SELECT (col)
--    MERGES with existing column grants — it never revokes the others, so
--    parallel #4xx migrations extending the same list cannot clobber each
--    other. UPDATE stays table-level (cases_admin_all RLS: admin/staff
--    only — parent owner writes were dropped in 20261017170000).
-- 4. tutors_owner_verified_guard re-emitted in full with ONE added freeze
--    line: is_fast_responder is a staff-only desk decision, so an owner JWT
--    must not be able to self-award ⚡ by PATCHing the column (same freeze
--    pattern as verification_tier / tutor_status / approved_grade_labels).

ALTER TABLE public.tutoring_cases
  ADD COLUMN IF NOT EXISTS priority_tier text
    NOT NULL DEFAULT 'UNASSIGNED'
    CHECK (priority_tier IN ('P1', 'P2', 'P3', 'P4', 'UNASSIGNED'));

COMMENT ON COLUMN public.tutoring_cases.priority_tier IS
  '#438: manual P1-P4 triage tier set by staff in the admin case desk.
  Desk buckets: Active = UNASSIGNED/P1/P2, Hold/Review = P3/P4.
  No LLM and no automation in V1 — humans decide priority.';

GRANT SELECT (priority_tier) ON public.tutoring_cases TO authenticated;

ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS is_fast_responder boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tutors.is_fast_responder IS
  '#438: manual staff toggle (no reply-time automation in V1). Drives the
  ⚡ badge in tutor shortlists (#428); frozen on the owner write path.';

-- ---------------------------------------------------------------------------
-- tutors_owner_verified_guard — re-emitted in full from 20261016110000; the
-- only change is the added is_fast_responder freeze. Staff/admin/service-role
-- writes pass untouched (TutorEditor toggles the flag with a staff JWT).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tutors_owner_verified_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_is_staff boolean;
BEGIN
  caller_is_staff :=
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'staff');

  -- Staff/admin JWT writes and service-role writes (auth.uid() IS NULL) pass;
  -- only the card's own owner account is constrained.
  IF caller_is_staff OR auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  -- Owner writes can NEVER move verification_tier, tutor_status,
  -- approved_grade_labels or is_fast_responder, at any tier: freeze all to
  -- their current values. The badge labels are trigger-maintained from
  -- staff-approved grade rows; is_fast_responder is a staff desk decision
  -- (#438). Self-awarding Verified or ⚡ is staff-only and the UI never
  -- sends these fields, so this is invisible to honest clients.
  NEW.verification_tier := OLD.verification_tier;
  NEW.tutor_status := OLD.tutor_status;
  NEW.approved_grade_labels := OLD.approved_grade_labels;
  NEW.is_fast_responder := OLD.is_fast_responder;

  IF COALESCE(OLD.verification_tier, 'tier_1_standard') = 'tier_2_verified' THEN
    IF (NEW.secondary_school IS DISTINCT FROM OLD.secondary_school)
      OR (NEW.highschool IS DISTINCT FROM OLD.highschool)
      OR (NEW.academic_headline IS DISTINCT FROM OLD.academic_headline)
      OR (NEW.undergrad_university IS DISTINCT FROM OLD.undergrad_university)
      OR (NEW.undergrad_degree IS DISTINCT FROM OLD.undergrad_degree)
      OR (NEW.undergrad_graduation_year IS DISTINCT FROM OLD.undergrad_graduation_year)
      OR (NEW.has_postgrad IS DISTINCT FROM OLD.has_postgrad)
      OR (NEW.postgrad_university IS DISTINCT FROM OLD.postgrad_university)
      OR (NEW.postgrad_degree IS DISTINCT FROM OLD.postgrad_degree)
      OR (NEW.qualifications_summary IS DISTINCT FROM OLD.qualifications_summary)
      OR (NEW.exam_results IS DISTINCT FROM OLD.exam_results)
      OR (NEW.achievements IS DISTINCT FROM OLD.achievements)
    THEN
      RAISE EXCEPTION 'verified credential fields are locked; ask staff to change them'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_tutors_owner_verified_guard ON public.tutors;
CREATE TRIGGER trg_tutors_owner_verified_guard
  BEFORE UPDATE ON public.tutors
  FOR EACH ROW
  EXECUTE FUNCTION public.tutors_owner_verified_guard();
