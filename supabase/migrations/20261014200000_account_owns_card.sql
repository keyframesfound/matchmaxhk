-- Epic #280 (P2/P3 groundwork): Account owns the card.
--
-- P2 — Google account owns the profile:
--   * profiles.google_sub: reference column storing the Google subject id
--     (ownership itself stays on auth.uid() / tutors.user_id — existing RLS).
--   * tutors.claimed_at: audit stamp set when a tutor claims their own card.
--   * tutor_claim_requests: staff queue for claims that cannot auto-resolve
--     (card already claimed by another account, or no application-email match).
--   * request_tutor_claim / confirm_tutor_claim / resolve_tutor_claim RPCs.
--
-- P3 — Tutor edits the card (server-side twins of the client rules):
--   * Verified tutors (tier_2_verified) cannot change credential fields
--     (school, degrees, exam results, achievements, examiner status) —
--     old value stays public; a P4 evidence queue will handle changes later.
--   * Owner updates cannot introduce contact details into public free text
--     (phone / email / chat-app handles), mirroring src/lib/contact-filter.ts.
--
-- Staff/admin/service-role writes bypass both guards (has_role check /
-- auth.uid() IS NULL), matching how TutorEditor and autofill run today.

-- ============ P2: ownership columns ============

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS google_sub TEXT;

COMMENT ON COLUMN public.profiles.google_sub IS
  'Google subject id (id token "sub") of the owning identity, stored for reference. Ownership itself is auth.uid() (profiles.id).';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_google_sub_key
  ON public.profiles (google_sub)
  WHERE google_sub IS NOT NULL;

ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.tutors.claimed_at IS
  'When the owning tutor account claimed this card themselves (P2). Admin-assigned links keep NULL.';

-- ============ P2: staff claim queue ============

CREATE TABLE public.tutor_claim_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES public.tutors(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'approved', 'rejected')),
  note text,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tutor_claim_requests IS
  'P2: tutor claims that need staff review — card already owned by another account, or the application email does not match the Google email.';

CREATE INDEX IF NOT EXISTS tutor_claim_requests_open_idx
  ON public.tutor_claim_requests (status, created_at)
  WHERE status = 'open';

ALTER TABLE public.tutor_claim_requests ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.tutor_claim_requests TO authenticated;

CREATE POLICY "tutor_claim_requests_owner_select" ON public.tutor_claim_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "tutor_claim_requests_staff_select" ON public.tutor_claim_requests
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'staff')
  );

-- Inserts/updates happen only inside the SECURITY DEFINER RPCs below.

-- ============ P2: claim RPCs ============

-- What can the caller do with this card?
--   'already_owned'    caller already owns it
--   'confirm'          application email matches → caller may confirm the claim
--   'staff_review'     queued for staff (no match, or card owned by someone else)
CREATE OR REPLACE FUNCTION public.request_tutor_claim(p_tutor_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tutor public.tutors%ROWTYPE;
  v_caller_email text;
  v_app_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_tutor FROM public.tutors WHERE id = p_tutor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'tutor card not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_tutor.user_id = auth.uid() THEN
    RETURN 'already_owned';
  END IF;

  SELECT email INTO v_caller_email FROM auth.users WHERE id = auth.uid();
  IF v_caller_email IS NULL THEN
    RAISE EXCEPTION 'account has no email' USING ERRCODE = '23502';
  END IF;

  SELECT ta.data->>'email' INTO v_app_email
  FROM public.tutor_applications ta
  WHERE ta.linked_tutor_id = p_tutor_id
  ORDER BY ta.created_at DESC
  LIMIT 1;

  -- Card owned by another account → always staff (P2: "a second claim goes to staff").
  IF v_tutor.user_id IS NOT NULL OR lower(COALESCE(v_app_email, '')) <> lower(v_caller_email) THEN
    -- One open request per account per card is enough.
    IF NOT EXISTS (
      SELECT 1 FROM public.tutor_claim_requests
      WHERE tutor_id = p_tutor_id AND user_id = auth.uid() AND status = 'open'
    ) THEN
      INSERT INTO public.tutor_claim_requests (tutor_id, user_id, email, note)
      VALUES (
        p_tutor_id,
        auth.uid(),
        v_caller_email,
        CASE
          WHEN v_tutor.user_id IS NOT NULL THEN 'card already linked to another account'
          ELSE 'application email does not match account email'
        END
      );
    END IF;

    RETURN 'staff_review';
  END IF;

  RETURN 'confirm';
END;
$function$;

-- Perform a confirmed claim. Re-checks the email match server-side; the
-- client's "confirm" step is UX, never the authorization.
CREATE OR REPLACE FUNCTION public.confirm_tutor_claim(p_tutor_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tutor public.tutors%ROWTYPE;
  v_caller_email text;
  v_app_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_tutor FROM public.tutors WHERE id = p_tutor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'tutor card not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_tutor.user_id = auth.uid() THEN
    RETURN 'already_owned';
  END IF;

  IF v_tutor.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'card already claimed' USING ERRCODE = '23505';
  END IF;

  SELECT email INTO v_caller_email FROM auth.users WHERE id = auth.uid();

  SELECT ta.data->>'email' INTO v_app_email
  FROM public.tutor_applications ta
  WHERE ta.linked_tutor_id = p_tutor_id
  ORDER BY ta.created_at DESC
  LIMIT 1;

  IF v_caller_email IS NULL OR lower(COALESCE(v_app_email, '')) <> lower(v_caller_email) THEN
    RAISE EXCEPTION 'email does not match the card application' USING ERRCODE = '23514';
  END IF;

  UPDATE public.tutors
    SET user_id = auth.uid(), claimed_at = now()
    WHERE id = p_tutor_id AND user_id IS NULL;

  INSERT INTO public.user_roles (user_id, role)
  SELECT auth.uid(), 'tutor'::public.app_role
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'tutor'::public.app_role
  );

  RETURN 'claimed';
END;
$function$;

-- Staff resolution of a queued claim. Approve links the card to the requester.
CREATE OR REPLACE FUNCTION public.resolve_tutor_claim(
  p_request_id uuid,
  p_approve boolean,
  p_note text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_req public.tutor_claim_requests%ROWTYPE;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'staff')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_req FROM public.tutor_claim_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'claim request not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_req.status <> 'open' THEN
    RAISE EXCEPTION 'claim request already resolved' USING ERRCODE = '23505';
  END IF;

  UPDATE public.tutor_claim_requests
    SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
        resolved_by = auth.uid(),
        resolved_at = now(),
        note = COALESCE(p_note, note)
    WHERE id = p_request_id;

  IF p_approve THEN
    UPDATE public.tutors
      SET user_id = v_req.user_id, claimed_at = now()
      WHERE id = v_req.tutor_id AND user_id IS NULL;

    INSERT INTO public.user_roles (user_id, role)
    SELECT v_req.user_id, 'tutor'::public.app_role
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_req.user_id AND role = 'tutor'::public.app_role
    );
    RETURN 'approved';
  END IF;

  RETURN 'rejected';
END;
$function$;

REVOKE ALL ON FUNCTION public.request_tutor_claim(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_tutor_claim(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_tutor_claim(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_tutor_claim(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_tutor_claim(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_tutor_claim(uuid, boolean, text) TO authenticated;

-- ============ P3: verified-field lock (owner path only) ============

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

  IF COALESCE(OLD.verification_tier, 'tier_1_standard') = 'tier_2_verified' THEN
    IF (NEW.secondary_school IS DISTINCT FROM OLD.secondary_school)
      OR (NEW.highschool IS DISTINCT FROM OLD.highschool)
      OR (NEW.undergrad_university IS DISTINCT FROM OLD.undergrad_university)
      OR (NEW.undergrad_degree IS DISTINCT FROM OLD.undergrad_degree)
      OR (NEW.undergrad_graduation_year IS DISTINCT FROM OLD.undergrad_graduation_year)
      OR (NEW.has_postgrad IS DISTINCT FROM OLD.has_postgrad)
      OR (NEW.postgrad_university IS DISTINCT FROM OLD.postgrad_university)
      OR (NEW.postgrad_degree IS DISTINCT FROM OLD.postgrad_degree)
      OR (NEW.qualifications_summary IS DISTINCT FROM OLD.qualifications_summary)
      OR (NEW.exam_results IS DISTINCT FROM OLD.exam_results)
      OR (NEW.achievements IS DISTINCT FROM OLD.achievements)
      OR (NEW.tutor_status IS DISTINCT FROM OLD.tutor_status)
      OR (NEW.verification_tier IS DISTINCT FROM OLD.verification_tier)
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

-- ============ P3: contact-filter guard on owner free-text ============

CREATE OR REPLACE FUNCTION public.tutors_owner_contact_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_is_staff boolean;
  v_text text;
BEGIN
  caller_is_staff :=
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'staff');

  IF caller_is_staff OR auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  FOREACH v_text IN ARRAY ARRAY[
    NEW.display_name, NEW.headline, NEW.bio, NEW.self_introduction,
    NEW.qualifications_summary, NEW.academic_headline, NEW.academic_summary
  ] LOOP
    CONTINUE WHEN v_text IS NULL;
    IF v_text ~* '[\w.+-]+@[\w-]+\.[\w.-]+'
      OR v_text ~* 'wa\.me'
      OR v_text ~* 'whatsapp'
      OR v_text ~* 'wechat'
      OR v_text ~* 'signal'
      OR v_text ~* 'telegram'
      OR v_text ~* 'instagram'
      OR v_text ~* '小紅書'
      OR v_text ~* 'ig[:\s]'
    THEN
      RAISE EXCEPTION 'contact details are not allowed on the public card'
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_tutors_owner_contact_guard ON public.tutors;
CREATE TRIGGER trg_tutors_owner_contact_guard
  BEFORE UPDATE ON public.tutors
  FOR EACH ROW
  EXECUTE FUNCTION public.tutors_owner_contact_guard();
