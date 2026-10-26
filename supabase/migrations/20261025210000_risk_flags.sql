-- Issue #441: manual risk flags on cases + tutors (V1 = visibility + audit).
--
-- CS marks suspicious cases/tutors before heads-ups or phone unlock. The CEO
-- locks this table encodes:
--   * Detection is MANUAL ONLY — nothing in the schema auto-writes a flag
--     (no triggers, no WABA/display-name coupling). Flags never delete or
--     archive anything; a BLOCKED row stays listed everywhere (stop-marker
--     badge only) and never blocks matching or phone unlock by itself.
--   * Authority (REVIEW = any staff, BLOCKED = operator/admin) lives in the
--     set-flag server fn, re-checked on every call — the DB layer's job is
--     to make the table unreachable from clients.
--
-- Design: ONE staff-only state table keyed by entity (case_id XOR tutor_id),
-- following the #383 case_flags posture (RLS enabled, no policies, ZERO
-- grants to anon/authenticated; reads/writes via service role inside
-- admin-gated server fns). Deliberately NOT inline columns on
-- tutoring_cases/tutors: tutors is the anon-readable public profile source
-- (table-level SELECT grant — new columns would be public the moment they
-- exist) and the public case board reads tutoring_cases through a column
-- whitelist, so staff-only risk_note must live off those tables entirely.
--
-- One row per entity (plain UNIQUE on each nullable FK column — multiple
-- NULLs allowed, the XOR CHECK enforces exactly one entity). The row is the
-- current flag state: upsert on set, no history table in V1. New rows mean
-- "was flagged at least once"; absence means NONE — no backfill needed.

CREATE TABLE IF NOT EXISTS public.risk_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid UNIQUE REFERENCES public.tutoring_cases(id) ON DELETE CASCADE,
  tutor_id uuid UNIQUE REFERENCES public.tutors(id) ON DELETE CASCADE,
  risk_flag text NOT NULL CHECK (risk_flag IN ('NONE', 'REVIEW', 'BLOCKED')),
  risk_note text,
  risk_flagged_at timestamptz,
  risk_flagged_by uuid,
  CONSTRAINT risk_flags_one_entity CHECK (num_nonnulls(case_id, tutor_id) = 1)
);

ALTER TABLE public.risk_flags ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.risk_flags FROM anon, authenticated;

COMMENT ON TABLE public.risk_flags IS
  'Issue #441: manual staff risk flag on a case or tutor (NONE/REVIEW/BLOCKED + short note + audit stamp). Service-role only via admin-gated server fns — never public, never auto-set.';
