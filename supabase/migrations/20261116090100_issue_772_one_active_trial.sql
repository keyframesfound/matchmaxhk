-- Issue #772 Part 1 — 1-Active-Trial anti-shopping lock (rebuilt ticket for [was #711]).
--
-- Product lock (§1.2 / §1.3 of the issue):
--   * At most ONE tutor may sit in the active-trial states for one case
--     request (case_request_id) at a time. Other shortlisted tutors are
--     locked until the current trial is closed (pre-L1 cancel or
--     stop-after-L1).
--   * Introduction #1 and #2 unlock cleanly. A third introduction ask
--     (trial_attempt_count >= 2) sets REQUIRES_OPS_APPROVAL on the request
--     and does NOT auto-unlock.
--   * The "active trial" definition stays the EXISTING SoR machine
--     (src/features/cases/sor.ts): introduced → lesson_1_scheduled →
--     lesson_1_done. No parallel case-status table is introduced here; the
--     new ledger only records WHICH tutor holds the one slot.
--
-- Live-catalog findings that shaped this file (probed via information_schema
-- before writing it):
--   * `trial_attempt_count` did NOT exist on any table.
--   * `failed_trial_pivot` is NOT a column — it is a VALUE of
--     tutoring_cases.status (case_request_status enum, the #449 rematch
--     pivot). So there was nothing to reuse; the counter is added here.
--   * `case_request_id` does not exist either: a case request IS a
--     tutoring_cases row, and a rematch creates a NEW row whose
--     replacement_of_case_id points at the closed trial. The "request" the
--     mutex is scoped to is therefore the ROOT of that chain, resolved by
--     case_request_root() below — same request, successor case.
--
-- Additive only: three nullable/defaulted columns + one new table + new
-- functions. Nothing is dropped and no existing row is rewritten.

-- ---------------------------------------------------------------------------
-- 1. Request-level rematch counter + ops-approval gate flag.
--    §1.4: trial_attempt_count = "count of trial introductions closed or
--    completed on this case_request_id (initial + rematches)". Introduction
--    #1 starts at 0.
-- ---------------------------------------------------------------------------

ALTER TABLE public.tutoring_cases
  ADD COLUMN IF NOT EXISTS trial_attempt_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.tutoring_cases
  ADD COLUMN IF NOT EXISTS requires_ops_approval boolean NOT NULL DEFAULT false;

ALTER TABLE public.tutoring_cases
  ADD COLUMN IF NOT EXISTS ops_approval_requested_at timestamptz;

COMMENT ON COLUMN public.tutoring_cases.trial_attempt_count IS
  'Issue #772: trial introductions on this request that have been closed (pre-L1 cancel, stop-after-L1 or replaced). 0 = the initial introduction; >= 2 means the next ask is a 3rd introduction and needs ops approval.';
COMMENT ON COLUMN public.tutoring_cases.requires_ops_approval IS
  'Issue #772: REQUIRES_OPS_APPROVAL on the request — set when a 3rd trial introduction is asked for; cleared by staff release on the desk.';
COMMENT ON COLUMN public.tutoring_cases.ops_approval_requested_at IS
  'Issue #772: when REQUIRES_OPS_APPROVAL was last raised (cleared together with the flag).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tutoring_cases'::regclass
      AND conname = 'tutoring_cases_trial_attempt_count_non_negative'
  ) THEN
    ALTER TABLE public.tutoring_cases
      ADD CONSTRAINT tutoring_cases_trial_attempt_count_non_negative
      CHECK (trial_attempt_count >= 0);
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Per-tutor trial introduction ledger (this is the MUTEX).
--    Rebuilt names (§1.4) map onto `state`:
--      INTRODUCED_ACTIVE       -> state = 'active'
--      CANCELLED_PRE_L1        -> state = 'closed_pre_l1'
--      STOPPED_AFTER_L1        -> state = 'closed_after_l1'
--      LOCKED_BY_ACTIVE_TRIAL  -> derived UI state, not stored
--    The case's own status still lives on tutoring_cases.sor_status; this
--    table only answers "which tutor holds the single active slot on this
--    request, and which ones were spent".
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.case_trial_intros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The case row this introduction belongs to (the initial request or its
  -- successor after a #449 rematch pivot).
  case_id uuid NOT NULL REFERENCES public.tutoring_cases(id) ON DELETE CASCADE,
  -- The case request the mutex is scoped to: the root of the
  -- replacement_of_case_id chain (case_request_root()).
  request_id uuid NOT NULL REFERENCES public.tutoring_cases(id) ON DELETE CASCADE,
  parent_id uuid,
  tutor_id uuid NOT NULL REFERENCES public.tutors(id) ON DELETE RESTRICT,
  -- §1.3.4: same request, same subject; child keeps multi-child requests
  -- distinguishable for the #759 duplicate-subject guard.
  subject_tag text,
  child_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  -- 1 = initial introduction, 2 = 1st free rematch, 3 = needs ops approval.
  sequence integer NOT NULL CHECK (sequence >= 1),
  state text NOT NULL DEFAULT 'active'
    CHECK (state IN ('active', 'closed_pre_l1', 'closed_after_l1', 'replaced')),
  source text NOT NULL DEFAULT 'in_app'
    CHECK (source IN ('in_app', 'whatsapp_desk', 'concierge')),
  -- #768 confirmed-trial write: the occupying case_lessons row whose
  -- confirmed status makes the public cell Occupied (derived at read time).
  lesson_id uuid REFERENCES public.case_lessons(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.case_trial_intros IS
  'Issue #772 Part 1: one row per trial introduction on a case request. The partial unique index below is the 1-active-trial mutex.';
COMMENT ON COLUMN public.case_trial_intros.request_id IS
  'Root of the replacement_of_case_id chain — the case_request_id the mutex is scoped by.';
COMMENT ON COLUMN public.case_trial_intros.state IS
  'active = INTRODUCED_ACTIVE (SoR introduced/lesson_1_scheduled/lesson_1_done); closed_pre_l1 = CANCELLED_PRE_L1; closed_after_l1 = STOPPED_AFTER_L1; replaced = #449 pivot.';

-- THE MUTEX: at most one ACTIVE trial introduction per case request.
CREATE UNIQUE INDEX IF NOT EXISTS case_trial_intros_one_active_per_request
  ON public.case_trial_intros (request_id)
  WHERE state = 'active';

-- One row per introduction number per request (retry-safe sequences).
CREATE UNIQUE INDEX IF NOT EXISTS case_trial_intros_sequence_unique
  ON public.case_trial_intros (request_id, sequence);

CREATE INDEX IF NOT EXISTS case_trial_intros_case_idx
  ON public.case_trial_intros (case_id);
CREATE INDEX IF NOT EXISTS case_trial_intros_tutor_idx
  ON public.case_trial_intros (tutor_id);
CREATE INDEX IF NOT EXISTS case_trial_intros_parent_subject_idx
  ON public.case_trial_intros (parent_id, subject_tag);

-- RLS: pg_default_acl grants anon+authenticated FULL privileges on every new
-- public table, so deny-by-default RLS + an explicit read policy is what
-- actually protects it. Writes go through the SECURITY DEFINER functions
-- below only (service_role).
ALTER TABLE public.case_trial_intros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS case_trial_intros_read_own ON public.case_trial_intros;
CREATE POLICY case_trial_intros_read_own
  ON public.case_trial_intros
  FOR SELECT
  TO authenticated
  USING (parent_id = auth.uid());

DROP POLICY IF EXISTS case_trial_intros_read_staff ON public.case_trial_intros;
CREATE POLICY case_trial_intros_read_staff
  ON public.case_trial_intros
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'staff'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

-- No client-side writes: the ledger is only written by the RPCs below.
REVOKE ALL ON public.case_trial_intros FROM anon, authenticated;
GRANT SELECT ON public.case_trial_intros TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. case_request_root(): the case_request_id the mutex is scoped by.
--    A #449 rematch creates a NEW tutoring_cases row whose
--    replacement_of_case_id points at the closed trial, so a request's
--    successive trials live on sibling rows. Walk to the chain root.
--    Cycle-guarded (max 20 hops) so bad data can never loop forever.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.case_request_root(_case_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := _case_id;
  v_parent uuid;
  v_hops int := 0;
BEGIN
  IF _case_id IS NULL THEN
    RETURN NULL;
  END IF;
  LOOP
    SELECT replacement_of_case_id INTO v_parent
    FROM public.tutoring_cases
    WHERE id = v_id;
    IF v_parent IS NULL THEN
      RETURN v_id;
    END IF;
    v_id := v_parent;
    v_hops := v_hops + 1;
    IF v_hops > 20 THEN
      RETURN _case_id;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.case_request_root(uuid) IS
  'Issue #772: resolves the case_request_id (chain root of replacement_of_case_id) a trial mutex is scoped by.';

-- ---------------------------------------------------------------------------
-- 4. case_trial_lock_state(): everything a surface needs to render the
--    mutex, the locked backup buttons and the 3rd-rematch ops notice.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.case_trial_lock_state(_case_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_root uuid;
  v_row public.tutoring_cases;
  v_active public.case_trial_intros;
  v_intros jsonb;
  v_closed int;
BEGIN
  v_root := public.case_request_root(_case_id);
  IF v_root IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'CASE_NOT_FOUND');
  END IF;

  SELECT * INTO v_row FROM public.tutoring_cases WHERE id = v_root;

  SELECT * INTO v_active
  FROM public.case_trial_intros
  WHERE request_id = v_root AND state = 'active'
  ORDER BY sequence
  LIMIT 1;

  SELECT count(*) INTO v_closed
  FROM public.case_trial_intros
  WHERE request_id = v_root AND state <> 'active';

  SELECT coalesce(
           jsonb_agg(
             jsonb_build_object(
               'introId', i.id,
               'caseId', i.case_id,
               'tutorId', i.tutor_id,
               'state', i.state,
               'sequence', i.sequence,
               'source', i.source,
               'lessonId', i.lesson_id,
               'startedAt', i.started_at,
               'closedAt', i.closed_at
             ) ORDER BY i.sequence
           ),
           '[]'::jsonb
         )
  INTO v_intros
  FROM public.case_trial_intros i
  WHERE i.request_id = v_root;

  RETURN jsonb_build_object(
    'ok', true,
    'caseId', _case_id,
    'requestId', v_root,
    'trialAttemptCount', coalesce(v_row.trial_attempt_count, 0),
    'closedAttemptCount', v_closed,
    'requiresOpsApproval', coalesce(v_row.requires_ops_approval, false),
    'opsApprovalRequestedAt', v_row.ops_approval_requested_at,
    'active', CASE WHEN v_active.id IS NULL THEN NULL ELSE jsonb_build_object(
      'introId', v_active.id,
      'caseId', v_active.case_id,
      'tutorId', v_active.tutor_id,
      'sequence', v_active.sequence,
      'source', v_active.source,
      'lessonId', v_active.lesson_id,
      'startedAt', v_active.started_at
    ) END,
    'intros', v_intros
  );
END;
$$;

COMMENT ON FUNCTION public.case_trial_lock_state(uuid) IS
  'Issue #772: mutex state for a case request chain — active trial, spent attempts, ops-approval flag, per-tutor intro ledger.';

-- ---------------------------------------------------------------------------
-- 5. claim_case_trial_intro(): open (or re-assert) the single active intro.
--    Returns {ok:false, reason:'LOCKED_BY_ACTIVE_TRIAL'} when another tutor
--    already holds the slot, and {ok:false, reason:'REQUIRES_OPS_APPROVAL'}
--    for a 3rd introduction ask — in that case it also RAISES the flag on
--    the request, which is the §1.7 acceptance criterion.
--    Serialised on the request row so two concurrent unlocks cannot both win
--    (the partial unique index is the second line of defence).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_case_trial_intro(
  _case_id uuid,
  _tutor_id uuid,
  _source text DEFAULT 'in_app',
  _lesson_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_root uuid;
  v_row public.tutoring_cases;
  v_active public.case_trial_intros;
  v_intro public.case_trial_intros;
  v_closed int;
  v_requires boolean;
  v_lock uuid;
BEGIN
  v_root := public.case_request_root(_case_id);
  IF v_root IS NULL OR _tutor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'CASE_NOT_FOUND');
  END IF;

  -- Serialise claims per request.
  SELECT id INTO v_lock FROM public.tutoring_cases WHERE id = v_root FOR UPDATE;
  SELECT * INTO v_row FROM public.tutoring_cases WHERE id = v_root;

  SELECT * INTO v_active
  FROM public.case_trial_intros
  WHERE request_id = v_root AND state = 'active'
  ORDER BY sequence
  LIMIT 1;

  IF v_active.id IS NOT NULL THEN
    IF v_active.tutor_id = _tutor_id AND v_active.case_id = _case_id THEN
      -- Idempotent re-assert (double click / retried transition).
      RETURN jsonb_build_object(
        'ok', true,
        'reason', 'ALREADY_ACTIVE',
        'introId', v_active.id,
        'sequence', v_active.sequence,
        'tutorId', v_active.tutor_id,
        'caseId', v_active.case_id
      );
    END IF;
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'LOCKED_BY_ACTIVE_TRIAL',
      'active', jsonb_build_object(
        'introId', v_active.id,
        'caseId', v_active.case_id,
        'tutorId', v_active.tutor_id,
        'sequence', v_active.sequence
      )
    );
  END IF;

  v_closed := coalesce(v_row.trial_attempt_count, 0);
  v_requires := coalesce(v_row.requires_ops_approval, false);

  -- §1.3.3: introduction #1 (0 spent) and #2 (1 spent) unlock cleanly; the
  -- 3rd ask (2 spent) never auto-unlocks.
  IF v_requires OR v_closed >= 2 THEN
    UPDATE public.tutoring_cases
    SET requires_ops_approval = true,
        ops_approval_requested_at = coalesce(ops_approval_requested_at, now())
    WHERE id = v_root;
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'REQUIRES_OPS_APPROVAL',
      'trialAttemptCount', v_closed,
      'requestId', v_root
    );
  END IF;

  BEGIN
    INSERT INTO public.case_trial_intros (
      case_id, request_id, parent_id, tutor_id, subject_tag, child_id,
      sequence, state, source, lesson_id
    )
    VALUES (
      _case_id,
      v_root,
      v_row.parent_id,
      _tutor_id,
      (v_row.subjects)[1],
      v_row.student_id,
      v_closed + 1,
      'active',
      coalesce(_source, 'in_app'),
      _lesson_id
    )
    RETURNING * INTO v_intro;
  EXCEPTION WHEN unique_violation THEN
    -- Lost the race against a concurrent unlock: converge on the winner.
    SELECT * INTO v_active
    FROM public.case_trial_intros
    WHERE request_id = v_root AND state = 'active'
    LIMIT 1;
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'LOCKED_BY_ACTIVE_TRIAL',
      'active', jsonb_build_object(
        'introId', v_active.id,
        'caseId', v_active.case_id,
        'tutorId', v_active.tutor_id,
        'sequence', v_active.sequence
      )
    );
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'reason', 'OPENED',
    'introId', v_intro.id,
    'sequence', v_intro.sequence,
    'tutorId', v_intro.tutor_id,
    'caseId', v_intro.case_id,
    'requestId', v_root
  );
END;
$$;

COMMENT ON FUNCTION public.claim_case_trial_intro(uuid, uuid, text, uuid) IS
  'Issue #772: opens the one active trial introduction per case request, or reports LOCKED_BY_ACTIVE_TRIAL / REQUIRES_OPS_APPROVAL.';

-- ---------------------------------------------------------------------------
-- 6. close_case_trial_intro(): spend the active intro and bump the request
--    counter. _close_kind: 'pre_l1' (cancel before Lesson 1, HK$0 matching
--    fee) | 'after_l1' (stop after Lesson 1, #760 owns the fee) | 'replaced'
--    (#449 pivot).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.close_case_trial_intro(
  _case_id uuid,
  _close_kind text DEFAULT 'pre_l1',
  _actor uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_root uuid;
  v_intro public.case_trial_intros;
  v_state text;
  v_count int;
BEGIN
  v_root := public.case_request_root(_case_id);
  IF v_root IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'CASE_NOT_FOUND');
  END IF;

  SELECT * INTO v_intro
  FROM public.case_trial_intros
  WHERE request_id = v_root AND state = 'active'
  ORDER BY sequence
  LIMIT 1;

  IF v_intro.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'NO_ACTIVE_INTRO', 'requestId', v_root);
  END IF;

  v_state := CASE
    WHEN _close_kind = 'after_l1' THEN 'closed_after_l1'
    WHEN _close_kind = 'replaced' THEN 'replaced'
    ELSE 'closed_pre_l1'
  END;

  UPDATE public.case_trial_intros
  SET state = v_state,
      closed_at = now(),
      closed_by = _actor
  WHERE id = v_intro.id;

  UPDATE public.tutoring_cases
  SET trial_attempt_count = coalesce(trial_attempt_count, 0) + 1
  WHERE id = v_root
  RETURNING trial_attempt_count INTO v_count;

  RETURN jsonb_build_object(
    'ok', true,
    'introId', v_intro.id,
    'tutorId', v_intro.tutor_id,
    'state', v_state,
    'trialAttemptCount', coalesce(v_count, 0),
    'requestId', v_root
  );
END;
$$;

COMMENT ON FUNCTION public.close_case_trial_intro(uuid, text, uuid) IS
  'Issue #772: closes the active trial introduction (pre-L1 cancel / stop-after-L1 / replaced) and increments the request trial_attempt_count.';

-- ---------------------------------------------------------------------------
-- 7. clear_case_ops_approval(): the ops release after review. Staff-only
--    path; the flag must not be clearable by the parent.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.clear_case_ops_approval(_case_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_root uuid;
  v_was boolean;
BEGIN
  v_root := public.case_request_root(_case_id);
  IF v_root IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'CASE_NOT_FOUND');
  END IF;
  SELECT coalesce(requires_ops_approval, false) INTO v_was
  FROM public.tutoring_cases WHERE id = v_root;
  UPDATE public.tutoring_cases
  SET requires_ops_approval = false,
      ops_approval_requested_at = NULL
  WHERE id = v_root;
  RETURN jsonb_build_object('ok', true, 'requestId', v_root, 'wasRaised', coalesce(v_was, false));
END;
$$;

COMMENT ON FUNCTION public.clear_case_ops_approval(uuid) IS
  'Issue #772: staff release of REQUIRES_OPS_APPROVAL after the concierge reviews a 3rd rematch request.';

-- ---------------------------------------------------------------------------
-- 8. case_active_trial_or_case(): the ONE shared signal for
--    #759's post-auth duplicate-subject guard (and #716's exclusion list).
--    Definition aligned with #716 (the shipped "Suggested for you" filter):
--    SoR introduced … active on the same subject for this user (+ child).
--    An active ledger intro counts even before the case's SoR has advanced
--    past board `matched`.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.case_active_trial_or_case(
  _user_id uuid,
  _subject text,
  _child_id uuid DEFAULT NULL,
  _exclude_case_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_sor constant text[] := ARRAY[
    'introduced', 'lesson_1_scheduled', 'lesson_1_done',
    'lesson_2_scheduled', 'lesson_2_done',
    'fee_invoiced', 'fee_paid', 'active'
  ];
  v_trial_sor constant text[] := ARRAY['introduced', 'lesson_1_scheduled', 'lesson_1_done'];
  v_row public.tutoring_cases;
  v_intro_id uuid;
BEGIN
  IF _user_id IS NULL OR coalesce(trim(_subject), '') = '' THEN
    RETURN jsonb_build_object('active', false);
  END IF;

  SELECT c.* INTO v_row
  FROM public.tutoring_cases c
  WHERE c.parent_id = _user_id
    AND (_child_id IS NULL OR c.student_id = _child_id)
    AND (_exclude_case_id IS NULL OR c.id <> _exclude_case_id)
    -- c.status is the case_request_status ENUM: never coalesce it to '' (22P02).
    AND (c.status IS NULL OR c.status NOT IN ('closed', 'rejected', 'released'))
    AND EXISTS (
      SELECT 1 FROM unnest(coalesce(c.subjects, '{}'::text[])) AS s
      WHERE lower(trim(s)) = lower(trim(_subject))
    )
    AND (
      c.sor_status = ANY (v_active_sor)
      OR EXISTS (
        SELECT 1 FROM public.case_trial_intros i
        WHERE i.case_id = c.id AND i.state = 'active'
      )
    )
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('active', false);
  END IF;

  SELECT i.id INTO v_intro_id
  FROM public.case_trial_intros i
  WHERE i.request_id = public.case_request_root(v_row.id) AND i.state = 'active'
  LIMIT 1;

  RETURN jsonb_build_object(
    'active', true,
    'kind', CASE WHEN v_row.sor_status = ANY (v_trial_sor) OR v_intro_id IS NOT NULL THEN 'trial' ELSE 'case' END,
    'caseId', v_row.id,
    'caseCode', v_row.case_code,
    'sorStatus', v_row.sor_status,
    'subject', _subject,
    'tutorId', v_row.matched_tutor_id,
    'trialIntroId', v_intro_id
  );
END;
$$;

COMMENT ON FUNCTION public.case_active_trial_or_case(uuid, text, uuid, uuid) IS
  'Issue #772: shared "has an active trial or confirmed case in this subject (and child if set)" signal for #759''s post-auth duplicate-subject guard and #716''s exclusion list.';

-- ---------------------------------------------------------------------------
-- 9. Function privileges.
--    Supabase default privileges give anon+authenticated EXECUTE at creation,
--    and a REVOKE ... FROM PUBLIC does not remove those grants — revoke the
--    client roles explicitly and grant service_role only. These functions
--    read/write other accounts' rows by user id, so they must never be
--    reachable with the anon key.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.case_request_root(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.case_trial_lock_state(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_case_trial_intro(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.close_case_trial_intro(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_case_ops_approval(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.case_active_trial_or_case(uuid, text, uuid, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.case_request_root(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.case_trial_lock_state(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_case_trial_intro(uuid, uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.close_case_trial_intro(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_case_ops_approval(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.case_active_trial_or_case(uuid, text, uuid, uuid) TO service_role;
