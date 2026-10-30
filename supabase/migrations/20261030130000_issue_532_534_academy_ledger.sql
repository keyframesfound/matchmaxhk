-- Epic #530 Academy Ops (Hybrid Managed) — Phase 0 spike (#532) + async_deliverables (#534).
--
-- Proves the two hard parts before any public booking UI:
--   1. Slot lock: two parents on the same tutor slot -> exactly one wins.
--   2. Credit ledger: append-only, idempotent, sum(entries) = balance.
--
-- Phase 0 decisions (spike report on #530):
--   * HOLD is created AT BOOK (confirm_slot_reservation), not at lesson start.
--   * No Redis on this stack (Cloudflare Workers + Supabase). The "TTL lock" is a
--     tutor_slot_reservations row with expires_at, serialised by
--     SELECT ... FOR UPDATE on the tutor row, backed by a GiST exclusion
--     constraint so overlap is impossible even if a caller skips the RPC.
--     Abandoned checkouts expire at expires_at and are swept by pg_cron.
--   * Credits are lesson credits, NUMERIC(8,2) (half credits allowed).
--     Managed tier only: pure-matching cases never get an account (#530 §0).
--
-- Exposure posture (#383 case_flags / #537 trust tables): RLS on, no policies,
-- zero grants to anon/authenticated. Only service-role server fns and the
-- SECURITY DEFINER RPCs below (EXECUTE revoked from public) touch these rows.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- students: per-student pack holder (#530 "start per-student packs").
-- Minimal on purpose; #459 child sub-profiles will own the full profile.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  case_id uuid REFERENCES public.tutoring_cases(id) ON DELETE SET NULL,
  display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_students_parent ON public.students (parent_user_id);
CREATE INDEX IF NOT EXISTS idx_students_case ON public.students (case_id);

-- ---------------------------------------------------------------------------
-- credit_accounts: one per student × tutor pack. balance / held are caches of
-- the ledger, only ever written by post_credit_entry under FOR UPDATE.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  tutor_id uuid REFERENCES public.tutors(id) ON DELETE RESTRICT,
  balance numeric(8, 2) NOT NULL DEFAULT 0,
  held numeric(8, 2) NOT NULL DEFAULT 0 CHECK (held >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, tutor_id)
);

-- ---------------------------------------------------------------------------
-- tutor_slot_reservations: the slot lock + short-lived reservation token.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tutor_slot_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES public.tutors(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'held'
    CHECK (status IN ('held', 'confirmed', 'released', 'expired')),
  reservation_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL,
  hold_entry_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at < ends_at),
  CHECK (status <> 'confirmed' OR hold_entry_id IS NOT NULL),
  -- Belt and braces under the RPC's FOR UPDATE: live slots can never overlap.
  CONSTRAINT tutor_slot_reservations_no_overlap EXCLUDE USING gist (
    tutor_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status IN ('held', 'confirmed'))
);
CREATE INDEX IF NOT EXISTS idx_slot_reservations_held_expiry
  ON public.tutor_slot_reservations (expires_at) WHERE status = 'held';

-- ---------------------------------------------------------------------------
-- credit_ledger_entries: append-only double-entry over (available, held).
--   PURCHASE   amount +n  held  0
--   HOLD       amount -n  held +n   (at book)
--   RELEASE    amount +n  held -n   (cancel in policy / absent excused)
--   CONSUME    amount  0  held -n   (present / late / absent billable)
--   ADJUSTMENT amount ±n  held  0   (admin only)
-- Invariant: sum(amount) = balance, sum(held_delta) = held, per account.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.credit_accounts(id) ON DELETE RESTRICT,
  entry_type text NOT NULL
    CHECK (entry_type IN ('PURCHASE', 'HOLD', 'RELEASE', 'CONSUME', 'ADJUSTMENT')),
  amount numeric(8, 2) NOT NULL,
  held_delta numeric(8, 2) NOT NULL,
  balance_after numeric(8, 2) NOT NULL,
  held_after numeric(8, 2) NOT NULL CHECK (held_after >= 0),
  idempotency_key text NOT NULL UNIQUE CHECK (char_length(idempotency_key) BETWEEN 8 AND 200),
  actor_id uuid,
  actor_role varchar(30) NOT NULL CHECK (actor_role IN ('admin', 'tutor', 'parent', 'system')),
  admin_override boolean NOT NULL DEFAULT false,
  hold_entry_id uuid REFERENCES public.credit_ledger_entries(id),
  reservation_id uuid REFERENCES public.tutor_slot_reservations(id),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (balance_after >= 0 OR admin_override),
  CHECK (NOT admin_override OR actor_role = 'admin'),
  CHECK ((entry_type IN ('RELEASE', 'CONSUME')) = (hold_entry_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_account
  ON public.credit_ledger_entries (account_id, created_at);
-- A hold settles exactly once: a duplicate attendance submit / webhook can
-- never CONSUME (or RELEASE) the same hold twice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_ledger_hold_settled_once
  ON public.credit_ledger_entries (hold_entry_id) WHERE hold_entry_id IS NOT NULL;

ALTER TABLE public.tutor_slot_reservations
  DROP CONSTRAINT IF EXISTS tutor_slot_reservations_hold_entry_fk;
ALTER TABLE public.tutor_slot_reservations
  ADD CONSTRAINT tutor_slot_reservations_hold_entry_fk
  FOREIGN KEY (hold_entry_id) REFERENCES public.credit_ledger_entries(id);

CREATE OR REPLACE FUNCTION public.credit_ledger_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'credit_ledger_entries is append-only; post a compensating entry'
    USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_ledger_append_only ON public.credit_ledger_entries;
CREATE TRIGGER trg_credit_ledger_append_only
  BEFORE UPDATE OR DELETE ON public.credit_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.credit_ledger_append_only();

-- ---------------------------------------------------------------------------
-- #534 async_deliverables: IA / EE / TOK / mock papers, peer of class sessions.
-- Schema now, portal UI in Phase 4. Shares the HOLD/CONSUME path through
-- credit_ledger_entries.deliverable_id.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.async_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  tutor_id uuid NOT NULL REFERENCES public.tutors(id) ON DELETE RESTRICT,
  deliverable_type varchar(30) NOT NULL
    CHECK (deliverable_type IN ('IA', 'EE', 'TOK', 'MOCK_PAPER', 'PERSONAL_STATEMENT', 'OTHER')),
  subject_tag text CHECK (subject_tag IS NULL OR char_length(subject_tag) <= 80),
  original_file_url text,
  annotated_file_url text,
  status varchar(30) NOT NULL DEFAULT 'DRAFT_UPLOADED'
    CHECK (status IN ('DRAFT_UPLOADED', 'TUTOR_REVIEWING', 'FEEDBACK_READY', 'CLOSED')),
  sla_deadline_utc timestamptz NOT NULL,
  credit_ledger_id uuid REFERENCES public.credit_ledger_entries(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'FEEDBACK_READY' OR annotated_file_url IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_async_deliverables_tutor_sla
  ON public.async_deliverables (tutor_id, sla_deadline_utc)
  WHERE status IN ('DRAFT_UPLOADED', 'TUTOR_REVIEWING');

ALTER TABLE public.credit_ledger_entries
  ADD COLUMN IF NOT EXISTS deliverable_id uuid REFERENCES public.async_deliverables(id);

-- ---------------------------------------------------------------------------
-- RLS + grants: staff-only via service role.
-- ---------------------------------------------------------------------------
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_slot_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.async_deliverables ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.students, public.credit_accounts, public.tutor_slot_reservations,
      public.credit_ledger_entries, public.async_deliverables FROM anon, authenticated;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- post_credit_entry: the only writer of ledger rows and account balances.
-- Idempotent on idempotency_key; a hold settles once (a repeat settle of the
-- same type returns the existing row instead of double-consuming).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_credit_entry(
  p_account_id uuid,
  p_entry_type text,
  p_amount numeric,
  p_idempotency_key text,
  p_actor_id uuid,
  p_actor_role text,
  p_hold_entry_id uuid DEFAULT NULL,
  p_reservation_id uuid DEFAULT NULL,
  p_deliverable_id uuid DEFAULT NULL,
  p_admin_override boolean DEFAULT false,
  p_note text DEFAULT NULL
)
RETURNS public.credit_ledger_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.credit_ledger_entries;
  v_account public.credit_accounts;
  v_hold public.credit_ledger_entries;
  v_amount numeric(8, 2);
  v_held_delta numeric(8, 2);
  v_row public.credit_ledger_entries;
BEGIN
  SELECT * INTO v_existing FROM public.credit_ledger_entries
    WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.account_id <> p_account_id OR v_existing.entry_type <> p_entry_type THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE = 'P0001';
    END IF;
    RETURN v_existing;
  END IF;

  SELECT * INTO v_account FROM public.credit_accounts WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF p_entry_type IN ('RELEASE', 'CONSUME') THEN
    SELECT * INTO v_hold FROM public.credit_ledger_entries
      WHERE id = p_hold_entry_id AND account_id = p_account_id AND entry_type = 'HOLD';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'HOLD_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    -- Already settled (the account lock serialises settlers): same type is a
    -- duplicate submit -> return it; the other type is a conflict.
    SELECT * INTO v_existing FROM public.credit_ledger_entries
      WHERE hold_entry_id = p_hold_entry_id;
    IF FOUND THEN
      IF v_existing.entry_type = p_entry_type THEN
        RETURN v_existing;
      END IF;
      RAISE EXCEPTION 'HOLD_ALREADY_SETTLED' USING ERRCODE = 'P0001';
    END IF;
    v_held_delta := v_hold.amount;  -- HOLD amount is negative
    v_amount := CASE WHEN p_entry_type = 'RELEASE' THEN -v_hold.amount ELSE 0 END;
  ELSIF p_entry_type = 'PURCHASE' THEN
    IF p_amount IS NULL OR p_amount <= 0 THEN
      RAISE EXCEPTION 'AMOUNT_MUST_BE_POSITIVE' USING ERRCODE = '22023';
    END IF;
    v_amount := p_amount;
    v_held_delta := 0;
  ELSIF p_entry_type = 'HOLD' THEN
    IF p_amount IS NULL OR p_amount <= 0 THEN
      RAISE EXCEPTION 'AMOUNT_MUST_BE_POSITIVE' USING ERRCODE = '22023';
    END IF;
    v_amount := -p_amount;
    v_held_delta := p_amount;
  ELSIF p_entry_type = 'ADJUSTMENT' THEN
    IF p_actor_role <> 'admin' THEN
      RAISE EXCEPTION 'ADJUSTMENT_ADMIN_ONLY' USING ERRCODE = '42501';
    END IF;
    IF p_amount IS NULL OR p_amount = 0 THEN
      RAISE EXCEPTION 'AMOUNT_MUST_BE_NONZERO' USING ERRCODE = '22023';
    END IF;
    v_amount := p_amount;
    v_held_delta := 0;
  ELSE
    RAISE EXCEPTION 'UNKNOWN_ENTRY_TYPE' USING ERRCODE = '22023';
  END IF;

  IF v_account.balance + v_amount < 0 AND NOT (p_admin_override AND p_actor_role = 'admin') THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.credit_ledger_entries (
    account_id, entry_type, amount, held_delta, balance_after, held_after,
    idempotency_key, actor_id, actor_role, admin_override, hold_entry_id,
    reservation_id, deliverable_id, note
  ) VALUES (
    p_account_id, p_entry_type, v_amount, v_held_delta,
    v_account.balance + v_amount, v_account.held + v_held_delta,
    p_idempotency_key, p_actor_id, p_actor_role,
    p_admin_override AND p_actor_role = 'admin', p_hold_entry_id,
    COALESCE(p_reservation_id, v_hold.reservation_id),
    COALESCE(p_deliverable_id, v_hold.deliverable_id), p_note
  ) RETURNING * INTO v_row;

  UPDATE public.credit_accounts
    SET balance = v_row.balance_after, held = v_row.held_after, updated_at = now()
    WHERE id = p_account_id;

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- Slot lock RPCs.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_expired_slot_reservations()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH swept AS (
    UPDATE public.tutor_slot_reservations
      SET status = 'expired', updated_at = now()
      WHERE status = 'held' AND expires_at <= now()
      RETURNING 1
  )
  SELECT count(*)::integer FROM swept;
$$;

CREATE OR REPLACE FUNCTION public.reserve_tutor_slot(
  p_tutor_id uuid,
  p_starts_at timestamptz,
  p_duration_min integer,
  p_student_id uuid,
  p_actor_id uuid,
  p_ttl_seconds integer DEFAULT 600
)
RETURNS public.tutor_slot_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ends_at timestamptz := p_starts_at + make_interval(mins => p_duration_min);
  v_row public.tutor_slot_reservations;
BEGIN
  IF p_duration_min IS NULL OR p_duration_min NOT BETWEEN 15 AND 480 THEN
    RAISE EXCEPTION 'INVALID_DURATION' USING ERRCODE = '22023';
  END IF;
  IF p_ttl_seconds IS NULL OR p_ttl_seconds NOT BETWEEN 30 AND 1800 THEN
    RAISE EXCEPTION 'INVALID_TTL' USING ERRCODE = '22023';
  END IF;
  IF p_starts_at <= now() THEN
    RAISE EXCEPTION 'SLOT_IN_PAST' USING ERRCODE = '22023';
  END IF;

  -- Serialise every booker of this tutor; the loser waits, then sees the winner.
  PERFORM 1 FROM public.tutors WHERE id = p_tutor_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TUTOR_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.tutor_slot_reservations
    SET status = 'expired', updated_at = now()
    WHERE tutor_id = p_tutor_id AND status = 'held' AND expires_at <= now();

  IF EXISTS (
    SELECT 1 FROM public.tutor_slot_reservations
      WHERE tutor_id = p_tutor_id AND status IN ('held', 'confirmed')
        AND tstzrange(starts_at, ends_at) && tstzrange(p_starts_at, v_ends_at)
  ) OR EXISTS (
    SELECT 1 FROM public.case_lessons
      WHERE tutor_id = p_tutor_id AND status IN ('planned', 'confirmed')
        AND tstzrange(starts_at, starts_at + make_interval(mins => duration_min))
            && tstzrange(p_starts_at, v_ends_at)
  ) THEN
    RAISE EXCEPTION 'SLOT_TAKEN' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.tutor_slot_reservations (
    tutor_id, student_id, starts_at, ends_at, expires_at, created_by
  ) VALUES (
    p_tutor_id, p_student_id, p_starts_at, v_ends_at,
    now() + make_interval(secs => p_ttl_seconds), p_actor_id
  ) RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- Checkout complete: HOLD the credit at book and confirm the slot. Idempotent
-- on the token (a retried confirm returns the confirmed row).
CREATE OR REPLACE FUNCTION public.confirm_slot_reservation(
  p_token uuid,
  p_account_id uuid,
  p_credits numeric,
  p_actor_id uuid,
  p_actor_role text
)
RETURNS public.tutor_slot_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res public.tutor_slot_reservations;
  v_hold public.credit_ledger_entries;
BEGIN
  SELECT * INTO v_res FROM public.tutor_slot_reservations
    WHERE reservation_token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESERVATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_res.status = 'confirmed' THEN
    RETURN v_res;
  END IF;
  IF v_res.status <> 'held' OR v_res.expires_at <= now() THEN
    UPDATE public.tutor_slot_reservations
      SET status = 'expired', updated_at = now()
      WHERE id = v_res.id AND status = 'held';
    RAISE EXCEPTION 'RESERVATION_EXPIRED' USING ERRCODE = 'P0001';
  END IF;

  v_hold := public.post_credit_entry(
    p_account_id, 'HOLD', p_credits, 'hold:' || v_res.id::text,
    p_actor_id, p_actor_role, NULL, v_res.id
  );

  UPDATE public.tutor_slot_reservations
    SET status = 'confirmed', hold_entry_id = v_hold.id, updated_at = now()
    WHERE id = v_res.id
    RETURNING * INTO v_res;
  RETURN v_res;
END;
$$;

-- Abandon / cancel before confirm. Idempotent.
CREATE OR REPLACE FUNCTION public.release_slot_reservation(p_token uuid)
RETURNS public.tutor_slot_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res public.tutor_slot_reservations;
BEGIN
  UPDATE public.tutor_slot_reservations
    SET status = 'released', updated_at = now()
    WHERE reservation_token = p_token AND status = 'held'
    RETURNING * INTO v_res;
  IF FOUND THEN
    RETURN v_res;
  END IF;
  SELECT * INTO v_res FROM public.tutor_slot_reservations WHERE reservation_token = p_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESERVATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_res.status = 'confirmed' THEN
    RAISE EXCEPTION 'RESERVATION_CONFIRMED' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION public.post_credit_entry(uuid, text, numeric, text, uuid, text, uuid, uuid, uuid, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_expired_slot_reservations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_tutor_slot(uuid, timestamptz, integer, uuid, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_slot_reservation(uuid, uuid, numeric, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_slot_reservation(uuid) FROM PUBLIC;

-- Supabase default privileges grant EXECUTE to anon/authenticated directly,
-- so REVOKE ... FROM PUBLIC alone leaves these callable over /rest/v1/rpc.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE EXECUTE ON FUNCTION public.post_credit_entry(uuid, text, numeric, text, uuid, text, uuid, uuid, uuid, boolean, text) FROM anon, authenticated;
    REVOKE EXECUTE ON FUNCTION public.release_expired_slot_reservations() FROM anon, authenticated;
    REVOKE EXECUTE ON FUNCTION public.reserve_tutor_slot(uuid, timestamptz, integer, uuid, uuid, integer) FROM anon, authenticated;
    REVOKE EXECUTE ON FUNCTION public.confirm_slot_reservation(uuid, uuid, numeric, uuid, text) FROM anon, authenticated;
    REVOKE EXECUTE ON FUNCTION public.release_slot_reservation(uuid) FROM anon, authenticated;
    REVOKE EXECUTE ON FUNCTION public.credit_ledger_append_only() FROM anon, authenticated;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.post_credit_entry(uuid, text, numeric, text, uuid, text, uuid, uuid, uuid, boolean, text) TO service_role;
    GRANT EXECUTE ON FUNCTION public.release_expired_slot_reservations() TO service_role;
    GRANT EXECUTE ON FUNCTION public.reserve_tutor_slot(uuid, timestamptz, integer, uuid, uuid, integer) TO service_role;
    GRANT EXECUTE ON FUNCTION public.confirm_slot_reservation(uuid, uuid, numeric, uuid, text) TO service_role;
    GRANT EXECUTE ON FUNCTION public.release_slot_reservation(uuid) TO service_role;
  END IF;
END;
$$;

-- Abandoned checkouts: the RPC already ignores expired holds; the sweep keeps
-- the table honest for reporting. Every minute, so release <= TTL + 60s.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'release-expired-slot-reservations';
    PERFORM cron.schedule(
      'release-expired-slot-reservations',
      '* * * * *',
      'SELECT public.release_expired_slot_reservations();'
    );
  END IF;
END;
$$;
