-- Issue #650 Safety lite: trusted contact + share-first-visit window state.
--
-- Two small tables, both OWNER-SELECT-ONLY under RLS (PDPO-minimised: a
-- parent's trusted contact is visible to nobody else, and there is
-- deliberately NO staff/admin policy — support never needs to read contact
-- data). EVERY write goes through service-role server fns
-- (src/features/safety/safety.functions.ts) after the server has checked
-- ownership — the terms_acceptances pattern (#214, hardening #374): zero
-- anon/authenticated INSERT/UPDATE/DELETE, so a hand-rolled PostgREST call
-- can neither save a contact nor flip another case's share state.
--
--   trusted_contacts     max ONE per parent (CEO lock, UNIQUE(parent_id));
--                        display name + phone, editable/deletable anytime,
--                        never required to book.
--   case_safety_shares   one row per case tracking the soft auto-prompt
--                        lifecycle: prompt_seen_at (stamped when the one soft
--                        prompt for the case first renders), dismissed_at
--                        (dismissible forever for that case), shared_at.
--                        Owner-scoping is enforced server-side: the server
--                        fn only writes rows for tutoring_cases rows the
--                        signed-in parent owns.
--
-- MUST NOT (V1, #650): Uber PIN, RideCheck, live audio, continuous location
-- tracking, panic button. Nothing here stores addresses, exact units or any
-- share payload — the share body is built client-side and never persisted.

-- ---------------------------------------------------------------------------
-- trusted_contacts (max 1 per parent, CEO lock #650)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trusted_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 80),
  phone text NOT NULL CHECK (char_length(btrim(phone)) BETWEEN 6 AND 32),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- CEO lock: one trusted contact per account in V1.
  UNIQUE (parent_id)
);

CREATE INDEX IF NOT EXISTS idx_trusted_contacts_parent ON public.trusted_contacts (parent_id);

ALTER TABLE public.trusted_contacts ENABLE ROW LEVEL SECURITY;

-- Reads: the parent sees their own single row (settings console + share
-- sheet recipient prefill). Writes: NONE for client roles — the server fn
-- upserts/deletes through the service-role client after auth. TRUNCATE is
-- revoked too: it is a table-level write RLS cannot police (Supabase's
-- default privileges grant ALL to anon/authenticated on new tables).
REVOKE ALL ON public.trusted_contacts FROM anon, authenticated;
GRANT SELECT ON public.trusted_contacts TO authenticated;

CREATE POLICY trusted_contacts_owner_select ON public.trusted_contacts
  FOR SELECT TO authenticated
  USING (auth.uid() = parent_id);
-- No INSERT/UPDATE/DELETE policies for ANY client role (anon, authenticated,
-- staff, admin): contact rows are written by the service-role server fn only.

DROP TRIGGER IF EXISTS trg_trusted_contacts_updated_at ON public.trusted_contacts;
CREATE TRIGGER trg_trusted_contacts_updated_at
  BEFORE UPDATE ON public.trusted_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.trusted_contacts IS
  'Issue #650: parent trusted contact (optional, max 1 in V1). PDPO-minimised: owner-SELECT RLS only, no staff policy, never required to book; writes are service-role only. Share payloads are built client-side and never stored here.';

-- ---------------------------------------------------------------------------
-- case_safety_shares (one soft auto-prompt lifecycle per case, #650)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_safety_shares (
  case_id uuid PRIMARY KEY REFERENCES public.tutoring_cases(id) ON DELETE CASCADE,
  parent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_seen_at timestamptz,
  dismissed_at timestamptz,
  shared_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_safety_shares_parent ON public.case_safety_shares (parent_id);

ALTER TABLE public.case_safety_shares ENABLE ROW LEVEL SECURITY;

-- Reads: the owning parent reads their case's lifecycle row (via the
-- server-computed case detail). Writes: NONE for client roles — mark-seen /
-- dismiss / shared stamps go through the service-role server fn, which
-- verifies tutoring_cases.parent_id = auth.uid() first (dismissal state is
-- owner-scoped in app code, not by a client-writable policy). TRUNCATE is
-- revoked too: it is a table-level write RLS cannot police.
REVOKE ALL ON public.case_safety_shares FROM anon, authenticated;
GRANT SELECT ON public.case_safety_shares TO authenticated;

CREATE POLICY case_safety_shares_owner_select ON public.case_safety_shares
  FOR SELECT TO authenticated
  USING (auth.uid() = parent_id);
-- No write policies for any client role; see the trusted_contacts note above.

DROP TRIGGER IF EXISTS trg_case_safety_shares_updated_at ON public.case_safety_shares;
CREATE TRIGGER trg_case_safety_shares_updated_at
  BEFORE UPDATE ON public.case_safety_shares
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.case_safety_shares IS
  'Issue #650: per-case first-visit share state. prompt_seen_at limits the soft auto-prompt to once per case; dismissed_at is the dismiss-forever marker; shared_at marks a share. Owner-scoped server-side; no payload content is stored.';
