-- Issue #794 §2.3 (AC-560-1..AC-560-4) — Verified Need substrate.
--
-- ADDITIVE ONLY: one new table, its indexes/constraints, one new private storage
-- bucket and one service-role storage policy. Nothing existing is altered.
--
-- Model
--   access_verifications  one row per verification attempt by an account. The
--                         bytes live in the private `access-verification` bucket
--                         at `file_path` until staff decide; the decision nulls
--                         `file_path`/`file_name` so a decided row can never
--                         still point at a document (AC-560-3).
--
--   Absence of a verified row IS the Self-Declared state — there is deliberately
--   no `self_declared` status. Statuses are only:
--     pending   uploaded, waiting on staff
--     verified  approved; `verified_until = reviewed_at + 12 months` and the
--               account-level pass optionally cascades to the household's other
--               child sub-profiles (public.students.owner_user_id)
--     rejected  declined, with an optional staff decision note
--     expired   a previously verified pass past `verified_until`
--
-- Visibility (never browser-navigable)
--   Tutors must never reach the document. There is deliberately NO grant to
--   anon/authenticated: pg_default_acl would otherwise hand every browser role
--   full privileges on a new public table, so the REVOKE below is what protects
--   it. Browsers only ever upload through a signed URL minted by a server fn;
--   only service-role server fns (staff) read. RLS stays enabled with explicit
--   deny-all policies so the table can never become an accidental open surface
--   if a grant is added later.

-- ---------------------------------------------------------------------------
-- Storage bucket: private, 10 MB per object. A proof of need is a scan or a
-- photo of one letter, not a file archive.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('access-verification', 'access-verification', false, 10485760)
on conflict (id) do nothing;

-- Idempotent guard: if the bucket already existed (partial earlier run), make
-- sure it still carries the private flag and the 10 MB cap. Scoped to this one
-- bucket id, so no other bucket is touched.
update storage.buckets
set public = false,
    file_size_limit = 10485760
where id = 'access-verification'
  and (public is distinct from false or file_size_limit is distinct from 10485760::bigint);

-- Service-role only: the server fn writes and mints signed read URLs for staff.
-- Anonymous and authenticated roles get no policy at all on this bucket.
drop policy if exists "Service role manages access verification" on storage.objects;
create policy "Service role manages access verification"
  on storage.objects
  for all
  to service_role
  using (bucket_id = 'access-verification')
  with check (bucket_id = 'access-verification');

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.access_verifications (
  id uuid primary key default gen_random_uuid(),
  -- CASCADE: a deleted auth user takes their verification attempts with them.
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'rejected', 'expired')),
  -- AC-560-1: the kind of proof the family uploaded. `other` keeps the flow
  -- open for evidence that fits none of the named schemes.
  proof_kind text not null
    check (proof_kind in (
      'cssa',
      'wfsfaa_full',
      'wfsfaa_half',
      'working_family_allowance',
      'public_housing',
      'ngo_letter',
      'social_worker_letter',
      'school_letter',
      'other'
    )),
  -- Object key inside the private `access-verification` bucket. NULL after the
  -- document is purged on decision (AC-560-3).
  file_path text,
  -- Original name for staff triage, NULL when purged.
  file_name text,
  -- Family's own words about the situation, 1-500 chars when present.
  context_note text
    check (context_note is null or char_length(context_note) between 1 and 500),
  -- Staff member who decided. SET NULL so deleting a staff account never
  -- destroys the family's audit trail.
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  -- AC-560-2: approved pass expiry, `reviewed_at + 12 months`.
  verified_until timestamptz,
  -- AC-560-4: let the pass cover the other child sub-profiles of the account
  -- (public.students.owner_user_id), not only the uploading child.
  cascade_to_household boolean not null default false,
  -- Staff's reason on approve/reject, 1-500 chars when present.
  decision_note text
    check (decision_note is null or char_length(decision_note) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A decided row must carry a review timestamp.
  constraint access_verifications_decision_check
    check (status = 'pending' or reviewed_at is not null),
  -- A verified row must carry both the review time and the 12-month expiry.
  constraint access_verifications_verified_check
    check (status <> 'verified' or (verified_until is not null and reviewed_at is not null)),
  -- AC-560-3: once decided, the row can never still point at a document.
  constraint access_verifications_purge_check
    check (reviewed_at is null or file_path is null)
);

comment on table public.access_verifications is
  '#794 §2.3 AC-560-1..AC-560-4: Verified Need attempts. Absence of a verified row is the Self-Declared state (no self_declared status). Service-role only — the raw proof lives in the private `access-verification` bucket, is reachable only by staff server fns via signed URLs, and is purged (file_path/file_name nulled) on decision. Tutors have no privilege on this table.';

comment on column public.access_verifications.user_id is
  '#794: the account that uploaded the proof. CASCADE from auth.users.';
comment on column public.access_verifications.status is
  '#794: pending | verified | rejected | expired. No self_declared row — absence of a verified row means Self-Declared.';
comment on column public.access_verifications.proof_kind is
  '#794 AC-560-1: cssa | wfsfaa_full | wfsfaa_half | working_family_allowance | public_housing | ngo_letter | social_worker_letter | school_letter | other.';
comment on column public.access_verifications.file_path is
  '#794 AC-560-3: object key in the private `access-verification` bucket, STAFF-ONLY. Set on upload, NULLed on decision — the purge check rejects any decided row that still carries a path.';
comment on column public.access_verifications.file_name is
  '#794: original proof file name for staff triage; NULLed when the document is purged on decision.';
comment on column public.access_verifications.context_note is
  '#794: optional family note on the situation, 1-500 chars when present.';
comment on column public.access_verifications.reviewed_by is
  '#794: staff member who approved or rejected. SET NULL on staff deletion.';
comment on column public.access_verifications.reviewed_at is
  '#794: when staff decided. Non-null for every non-pending status; also the anchor for `verified_until`.';
comment on column public.access_verifications.verified_until is
  '#794 AC-560-2: expiry of an approved pass — `reviewed_at + interval ''12 months''`. Required whenever status = verified.';
comment on column public.access_verifications.cascade_to_household is
  '#794 AC-560-4: when true the verified pass covers the other child sub-profiles of the same account (public.students.owner_user_id).';
comment on column public.access_verifications.decision_note is
  '#794: optional staff reason for the decision, 1-500 chars when present.';
comment on column public.access_verifications.created_at is
  '#794: upload time; ordering key for the staff review queue.';
comment on column public.access_verifications.updated_at is
  '#794: last row write (decision, expiry, note edits).';

-- One live attempt per account: no duplicate pending/verified rows. Rejected and
-- expired history is unconstrained, so a family can re-apply after a refusal.
create unique index if not exists uq_access_verifications_one_active
  on public.access_verifications (user_id)
  where status in ('pending', 'verified');

-- Staff review queue: oldest pending first.
create index if not exists idx_access_verifications_queue
  on public.access_verifications (status, created_at)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- Grants + RLS. Browser roles get nothing (the server fn is the only reader and
-- writer); service_role bypasses RLS and does the work.
-- ---------------------------------------------------------------------------
revoke all on public.access_verifications from anon, authenticated;
grant select, insert, update, delete on public.access_verifications to service_role;

alter table public.access_verifications enable row level security;

-- Explicit deny-all policies for authenticated. Unreachable while the grants
-- above are absent — kept so "RLS on, no policy" can never become a silent
-- grant-the-world default if a later migration adds privileges.
drop policy if exists access_verifications_deny_select on public.access_verifications;
create policy access_verifications_deny_select on public.access_verifications
  for select to authenticated using (false);

drop policy if exists access_verifications_deny_insert on public.access_verifications;
create policy access_verifications_deny_insert on public.access_verifications
  for insert to authenticated with check (false);

drop policy if exists access_verifications_deny_update on public.access_verifications;
create policy access_verifications_deny_update on public.access_verifications
  for update to authenticated using (false) with check (false);

drop policy if exists access_verifications_deny_delete on public.access_verifications;
create policy access_verifications_deny_delete on public.access_verifications
  for delete to authenticated using (false);
