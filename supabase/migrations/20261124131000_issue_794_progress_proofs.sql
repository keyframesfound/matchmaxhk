-- Issue #794 §2.6 (was #730) — the "Report Card Checked / 已核對成績憑證" half.
--
-- Desk verification of progress evidence, mirroring the shipped credential
-- evidence flow (#284, 20261016151000_tutor_credential_edits.sql) and the
-- Verified Need proof flow (#794 §2.3, 20261122230000_issue_794_need_verification.sql):
--   * one PRIVATE storage bucket, service-role only (no anon/authenticated
--     policy at all, exactly like access-verification / credential-evidence);
--   * the document key lives on the checkpoint row, is desk-only, and is
--     NULLed the moment staff decide (PDPO: purge on decision, never retain);
--   * unreviewed documents older than 14 days are swept by a lazy call from
--     the desk queue read — this repo has no cron (the #328 pattern).
--
-- ADDITIVE ONLY and idempotent. Four nullable columns on
-- public.case_progress_checkpoints (created in 20261124120000). No column is
-- dropped, renamed or narrowed, no default is changed, and no existing row is
-- touched: every existing checkpoint keeps verification as it is, with a NULL
-- proof pointer.
--
-- Verification states are unchanged (parent_attested | desk_checked |
-- tutor_unconfirmed). An upload NEVER publishes anything: it stamps
-- tutor_unconfirmed until staff approve, so a party cannot make their own
-- evidence public by uploading it.

-- ---------------------------------------------------------------------------
-- 1. Private storage bucket. 10 MB per object: a report card is one scan or
--    one photo of a slip, not an archive.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('progress-proofs', 'progress-proofs', false, 10485760)
on conflict (id) do nothing;

-- Idempotent guard: a partially applied earlier run must still end up private
-- and capped. Scoped to this one bucket id so no other bucket is touched.
update storage.buckets
set public = false,
    file_size_limit = 10485760
where id = 'progress-proofs'
  and (public is distinct from false or file_size_limit is distinct from 10485760::bigint);

-- Service role only. There is deliberately NO anon/authenticated policy: the
-- browser uploads through a service-role server fn and staff read through a
-- 10-minute signed URL minted by one. Dropping first keeps the statement
-- idempotent across re-runs.
drop policy if exists "Service role manages progress proofs" on storage.objects;
create policy "Service role manages progress proofs"
  on storage.objects
  for all
  to service_role
  using (bucket_id = 'progress-proofs')
  with check (bucket_id = 'progress-proofs');

-- ---------------------------------------------------------------------------
-- 2. Proof pointer + desk decision columns on the checkpoint row.
--    All nullable, all with "if not exists" so the migration is re-runnable.
-- ---------------------------------------------------------------------------
alter table public.case_progress_checkpoints
  add column if not exists proof_uploaded_at timestamptz,
  add column if not exists proof_reviewed_by uuid,
  add column if not exists proof_reviewed_at timestamptz,
  add column if not exists proof_rejection text;

comment on column public.case_progress_checkpoints.proof_uploaded_at is
  '#794 §2.6: when a case party uploaded the report-card / result-slip evidence. Starts the 14-day desk window; the sweep uses it to find stale unreviewed documents. Kept after a decision as the audit stamp that evidence existed, while proof_key is NULLed.';

comment on column public.case_progress_checkpoints.proof_reviewed_by is
  '#794 §2.6: the staff member who approved or rejected the evidence. SET NULL on staff-account deletion so the family''s checkpoint survives the departure.';

comment on column public.case_progress_checkpoints.proof_reviewed_at is
  '#794 §2.6: when the desk decided. Non-null with a NULL proof_key means the document was reviewed AND purged.';

comment on column public.case_progress_checkpoints.proof_rejection is
  '#794 §2.6: why the desk refused the document (free text, max 500). The literal ''rejected'' is stored when the reviewer gave no note, and ''expired'' when the 14-day sweep discarded an unreviewed upload, so a non-null value always means "the evidence was not accepted". Cleared to NULL when a proof is approved or a fresh upload is registered.';

comment on column public.case_progress_checkpoints.proof_key is
  '#794 §2.6 PDPO: desk-only object key in the private progress-proofs bucket. NEVER returned by any party/public read — the party reads use explicit column lists that omit it, and no public RPC exists. It is NULLed together with the storage object on EVERY decision (approve and reject) and by the 14-day sweep.';

-- The reviewed_by foreign key and the note length CHECK are added through
-- guarded blocks because ADD CONSTRAINT has no IF NOT EXISTS.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'case_progress_checkpoints_proof_reviewed_by_fkey'
      and conrelid = 'public.case_progress_checkpoints'::regclass
  ) then
    alter table public.case_progress_checkpoints
      add constraint case_progress_checkpoints_proof_reviewed_by_fkey
      foreign key (proof_reviewed_by) references auth.users (id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'case_progress_checkpoints_proof_rejection_check'
      and conrelid = 'public.case_progress_checkpoints'::regclass
  ) then
    alter table public.case_progress_checkpoints
      add constraint case_progress_checkpoints_proof_rejection_check
      check (proof_rejection is null or char_length(proof_rejection) between 1 and 500);
  end if;
end
$$;

-- Desk queue read: unreviewed documents, oldest upload first. Partial index so
-- it only ever covers the live queue, not the checkpoint history.
create index if not exists idx_case_progress_checkpoints_proof_queue
  on public.case_progress_checkpoints (proof_uploaded_at)
  where proof_key is not null;

-- ---------------------------------------------------------------------------
-- 3. Re-assert the browser lockdown (already applied in 20261124120000).
--    New columns inherit table-level privileges, so no new grant is needed;
--    this block exists purely so a re-run can never leave the table reachable
--    by a browser role.
-- ---------------------------------------------------------------------------
revoke all on public.case_progress_checkpoints from anon, authenticated;
grant select, insert, update, delete on public.case_progress_checkpoints to service_role;

alter table public.case_progress_checkpoints enable row level security;
