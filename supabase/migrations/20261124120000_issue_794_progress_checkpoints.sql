-- Issue #794 §2.6 (was #730) — Student Progress Evidence, checkpoints.
--
-- ADDITIVE ONLY. One new table, its indexes, one additive nullable column on
-- tutoring_cases (the parent's anonymous-share consent), and the RLS/grant
-- lockdown. No column is dropped, renamed or narrowed, so code still reading
-- the old shape is unaffected.
--
-- Model (§2.6 CEO lock 2026-11-18)
--   A card is the checkpoint SET of ONE case. Every checkpoint on a case must
--   share one scale_type — that rule ("check_progress_scale_coherent") lives in
--   code (src/features/cases/progress-checkpoints.functions.ts), NOT in a DB
--   trigger, because the same rule must also gate the read path and it is
--   cheaper to prove once in vitest than to duplicate in plpgsql.
--   assessed_on is stored as the FIRST of the month: the UI only collects
--   YYYY-MM, and a day-precision value would be an invented precision.
--   score_value is the native label the family typed ("5**", "Level 4", "82%");
--   score_numeric is derived for ORDERING WITHIN ONE SCALE only and is never
--   displayed, never compared across scales, and never aggregated.
--
-- PDPO
--   proof_key is a desk-only pointer to a cropped proof image. It is NEVER
--   returned by any public read (see the COMMENT below and
--   listPublicProgressCards, which selects an explicit column list that omits
--   it). Proof files are purged on desk decision by the §2.6 desk flow.
--
-- Visibility
--   Browsers never read this table. There is no grant to anon/authenticated;
--   the REVOKE below is what actually protects it (pg_default_acl would
--   otherwise hand the browser roles full privileges on a new public table).
--   Service-role server fns resolve the caller against the case and decide
--   what a party, the desk and /u/{handle} may see.

-- ---------------------------------------------------------------------------
-- 1. Case-level consent: the parent (or adult student) opts in to an ANONYMOUS
--    public card, and can revoke it (AC-730-4). Null = never consented = the
--    card stays private to the case. One column, one meaning, revocable by
--    setting it back to null.
-- ---------------------------------------------------------------------------
alter table public.tutoring_cases
  add column if not exists progress_share_consent_at timestamptz;

comment on column public.tutoring_cases.progress_share_consent_at is
  '#794 §2.6: when the parent (or adult student) consented to an ANONYMOUS public Student Progress Evidence card for this case. Null = not consented. Setting it back to null revokes the share and the card stops rendering on the next load (AC-730-4).';

-- ---------------------------------------------------------------------------
-- 2. Checkpoints
-- ---------------------------------------------------------------------------
create table if not exists public.case_progress_checkpoints (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.tutoring_cases(id) on delete cascade,
  -- Who typed the row. The server fn derives this from the caller's relation to
  -- the case; it is never taken from input.
  created_by uuid not null references public.profiles(id) on delete cascade,
  author_side text not null check (author_side in ('parent', 'tutor')),
  assessment_type text not null
    check (assessment_type in ('school_quiz', 'term_exam', 'mock', 'predicted', 'public_exam')),
  -- YYYY-MM as the first of the month; no invented day precision.
  assessed_on date not null
    check (extract(day from assessed_on) = 1),
  scale_type text not null
    check (scale_type in ('dse', 'ibdp', 'igcse', 'alevel', 'letter', 'percent')),
  -- The native label ("5**", "Level 4", "82%"). Never normalised across scales.
  score_value text not null
    check (char_length(btrim(score_value)) between 1 and 24),
  -- Ordering WITHIN the row's own scale only. Display and aggregation are
  -- forbidden by §2.6 (no cross-curriculum index, no average jump).
  score_numeric numeric,
  label text not null default ''
    check (char_length(label) <= 80),
  -- parent_attested | desk_checked are the two PUBLIC-eligible states.
  -- tutor_unconfirmed is a tutor-entered row the parent has not yet tapped to
  -- confirm; it stays private to the case (AC-730-2). Confirm flips it to
  -- parent_attested.
  verification text not null default 'tutor_unconfirmed'
    check (verification in ('parent_attested', 'desk_checked', 'tutor_unconfirmed')),
  parent_confirmed_at timestamptz,
  proof_key text,
  created_at timestamptz not null default now(),
  -- A desk-checked row is a staff decision, so it must carry no pending parent
  -- confirmation ambiguity; a parent-attested row is self-describing.
  constraint case_progress_checkpoints_confirmed_coherent
    check (verification <> 'parent_attested' or parent_confirmed_at is not null)
);

comment on table public.case_progress_checkpoints is
  '#794 §2.6: one row per Baseline / mid / Latest assessment on a tutoring case. A public card is the checkpoint set of ONE case, needing >= 2 points on one scale, the 4-lesson / 30-day / 6-hour floor, parent attestation or a desk document check, and case-level anonymous-share consent. Service-role only.';

comment on column public.case_progress_checkpoints.assessed_on is
  '#794 §2.6: assessment month stored as the first of the month (the UI only collects YYYY-MM).';

comment on column public.case_progress_checkpoints.score_numeric is
  '#794 §2.6: derived ordinal used ONLY to order points within one scale. Never displayed, never compared across scales, never aggregated into an improvement rate.';

comment on column public.case_progress_checkpoints.verification is
  '#794 §2.6: parent_attested / desk_checked are the two public-eligible states. tutor_unconfirmed (a tutor-entered row with no parent tap) stays private to the case.';

comment on column public.case_progress_checkpoints.proof_key is
  '#794 §2.6 PDPO: desk-only pointer to a cropped proof image. NEVER returned by any public read — listPublicProgressCards selects an explicit column list that omits this column, and no public RPC exists. The raw file is purged when the desk approves or rejects.';

-- ---------------------------------------------------------------------------
-- 3. Indexes: the case party reads newest-first; the public path only ever
--    wants rows that could be public, hence the partial index.
-- ---------------------------------------------------------------------------
create index if not exists idx_case_progress_checkpoints_case
  on public.case_progress_checkpoints (case_id, assessed_on desc);

create index if not exists idx_case_progress_checkpoints_public
  on public.case_progress_checkpoints (case_id, assessed_on desc)
  where verification in ('parent_attested', 'desk_checked');

-- ---------------------------------------------------------------------------
-- 4. Grants + RLS. Browser roles get nothing; the server fns are the only
--    readers and writers, and service_role bypasses RLS.
-- ---------------------------------------------------------------------------
revoke all on public.case_progress_checkpoints from anon, authenticated;
grant select, insert, update, delete on public.case_progress_checkpoints to service_role;

alter table public.case_progress_checkpoints enable row level security;

-- Explicit deny-all for both browser roles. Unreachable while the grants above
-- are absent — kept so "RLS on, no policy" can never become a silent
-- grant-the-world default if a later migration adds privileges.
drop policy if exists case_progress_checkpoints_deny_select on public.case_progress_checkpoints;
create policy case_progress_checkpoints_deny_select on public.case_progress_checkpoints
  for select to anon, authenticated using (false);

drop policy if exists case_progress_checkpoints_deny_insert on public.case_progress_checkpoints;
create policy case_progress_checkpoints_deny_insert on public.case_progress_checkpoints
  for insert to anon, authenticated with check (false);

drop policy if exists case_progress_checkpoints_deny_update on public.case_progress_checkpoints;
create policy case_progress_checkpoints_deny_update on public.case_progress_checkpoints
  for update to anon, authenticated using (false) with check (false);

drop policy if exists case_progress_checkpoints_deny_delete on public.case_progress_checkpoints;
create policy case_progress_checkpoints_deny_delete on public.case_progress_checkpoints
  for delete to anon, authenticated using (false);
