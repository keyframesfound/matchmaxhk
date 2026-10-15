-- PR #362 (#309) review fixes — close two owner-writable paths to the
-- Verified badge (grokbot review, 2026-10-15; already-live table/column).

-- A: the client policy "Tutors manage own grades" was FOR ALL with only an
-- ownership check, so an owner JWT could PATCH tutor_grades.status='approved'
-- straight through PostgREST — refresh_tutor_approved_grades then writes
-- tutors.approved_grade_labels and the public card shows Verified with no
-- staff review. All app mutations already go through service-role server fns
-- (uploadTutorGradeSlip / reviewTutorGrade), so the client keeps SELECT only.
DROP POLICY "Tutors manage own grades" ON public.tutor_grades;

CREATE POLICY "Tutors read own grades"
  ON public.tutor_grades
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tutors t
      WHERE t.id = tutor_grades.tutor_id AND t.user_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE client policies: staff review + slip uploads are
-- service-role server-fn paths only (issue #308 account_blocklist pattern).

-- B: tutors.approved_grade_labels was owner-writable via column UPDATE —
-- an owner could skip tutor_grades entirely and PATCH labels onto their card.
-- Freeze it on the owner path in tutors_owner_verified_guard, the same way
-- verification_tier / tutor_status are frozen. Re-emitted in full; the only
-- change vs 20261014200000 is the added freeze line.
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

  -- Owner writes can NEVER move verification_tier, tutor_status or
  -- approved_grade_labels, at any tier: freeze all to their current values.
  -- The badge labels are trigger-maintained from staff-approved grade rows;
  -- self-awarding Verified is a staff-only decision and the UI never sends
  -- these fields, so this is invisible to honest clients.
  NEW.verification_tier := OLD.verification_tier;
  NEW.tutor_status := OLD.tutor_status;
  NEW.approved_grade_labels := OLD.approved_grade_labels;

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
