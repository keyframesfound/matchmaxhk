-- #798: bring three pieces of out-of-band DDL into the repo.
--
-- The live project already had `tutors.city`, a legacy `tutors.time_zone`
-- and the `join_resume_drafts` table, but no migration created any of them, so
-- a fresh environment could not reproduce production. This file is additive and
-- re-runnable; it reproduces the live definitions (verified against the DB:
-- payload CHECK <= 64 KiB, unique token_hash, expiry index, service-role only).
--
-- It also repairs the AC-9 defect: the join intake wrote `time_zone` while the
-- scheduling readers, the settings picker and the CHECK constraint all use
-- `timezone`, so a confirmed zone never reached the column that scheduling
-- reads. The code now writes `timezone`; this backfills the one row that was
-- stranded in the legacy column.

alter table public.tutors add column if not exists city text;

alter table public.tutors add column if not exists time_zone text;

comment on column public.tutors.time_zone is
  '#798 legacy: the join intake wrote here before the canonical column was used. Deprecated — write tutors.timezone (validated by tutors_timezone_valid). Kept only so historical rows are not lost.';

update public.tutors
   set timezone = btrim(time_zone)
 where time_zone is not null
   and btrim(time_zone) <> ''
   and time_zone <> 'Asia/Hong_Kong'
   and timezone = 'Asia/Hong_Kong'
   and is_valid_timezone(btrim(time_zone));

create table if not exists public.join_resume_drafts (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint join_resume_drafts_payload_size check (pg_column_size(payload) <= 65536)
);

create index if not exists idx_join_resume_drafts_expiry
  on public.join_resume_drafts (expires_at);

alter table public.join_resume_drafts enable row level security;

revoke all on public.join_resume_drafts from anon, authenticated;
grant select, insert, update, delete on public.join_resume_drafts to service_role;
