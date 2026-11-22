-- Issue #785 AC-CONV-5 — case files (private storage bucket + metadata table,
-- 50 MB per-file cap). Also the storage substrate AC-CONV-3 needs for the
-- pre-class / homework / post-class material areas.
--
-- ADDITIVE ONLY: one new table, its indexes, one new private storage bucket and
-- one service-role storage policy. Nothing existing is altered — in particular
-- the #796 `case-mistakes` bucket and its 5 MB per-image cap are a DIFFERENT
-- limit and are not touched here.
--
-- Model
--   case_files  one row per uploaded file of a tutoring case. The bytes live in
--               the private `case-files` bucket at `file_path`; the row carries
--               only metadata so lists, counts and category filters never have
--               to list the bucket.
--     category   general | pre_class | homework | post_class  (#785 AC-CONV-3)
--     size_bytes 1 .. 52428800  (#785 AC-CONV-5 50 MB cap, mirrored by the
--               bucket's file_size_limit so the cap holds for direct writes too)
--
-- Visibility (never browser-direct)
--   Browsers never touch the bucket or this table. There is deliberately NO
--   grant to anon/authenticated: pg_default_acl would otherwise hand every
--   browser role full privileges on a new public table, so the REVOKE below is
--   what protects it. Service-role server fns resolve the caller against the
--   case, upload, and mint signed read URLs. RLS stays enabled with explicit
--   deny-all policies so the table can never become an accidental open surface
--   if a grant is added later.

-- ---------------------------------------------------------------------------
-- Storage bucket: private, 50 MB per object (#785 AC-CONV-5).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('case-files', 'case-files', false, 52428800)
on conflict (id) do nothing;

-- Idempotent guard: if the bucket already existed (partial earlier run), make
-- sure it still carries the private flag and the 50 MB cap. Scoped to this one
-- bucket id, so no other bucket is touched.
update storage.buckets
set public = false,
    file_size_limit = 52428800
where id = 'case-files'
  and (public is distinct from false or file_size_limit is distinct from 52428800::bigint);

-- Service-role only: the server fn writes and mints signed read URLs. Anonymous
-- and authenticated roles get no policy at all on this bucket.
drop policy if exists "Service role manages case files" on storage.objects;
create policy "Service role manages case files"
  on storage.objects
  for all
  to service_role
  using (bucket_id = 'case-files')
  with check (bucket_id = 'case-files');

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.case_files (
  id uuid primary key default gen_random_uuid(),
  -- CASCADE: a purged case takes its file rows with it (the bucket objects are
  -- removed by the server fn). A rematch is a NEW case row, so an old case's
  -- files never appear on the new one.
  case_id uuid not null references public.tutoring_cases (id) on delete cascade,
  -- #785 AC-CONV-3: which case area the file belongs to. `general` is the
  -- default so a file uploaded without a chosen area is still valid.
  category text not null default 'general'
    check (category in ('general', 'pre_class', 'homework', 'post_class')),
  -- Object key inside the `case-files` bucket. Unique: one metadata row per
  -- object, so a re-upload of the same key cannot double-count.
  file_path text not null,
  -- Original display name shown in the case file list, 1-200 trimmed chars.
  file_name text not null
    check (char_length(btrim(file_name)) between 1 and 200),
  content_type text not null,
  -- #785 AC-CONV-5: 50 MB cap, mirrored by the bucket's file_size_limit.
  size_bytes integer not null
    check (size_bytes between 1 and 52428800),
  uploaded_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint case_files_file_path_key unique (file_path)
);

comment on table public.case_files is
  '#785 AC-CONV-5: metadata for case files stored in the private `case-files` bucket (50 MB per file). Service-role only — browsers never touch the bucket or this table directly, they go through server fns with signed URLs.';

comment on column public.case_files.case_id is
  '#785: the case the file belongs to. CASCADE from tutoring_cases; a rematch is a new case row and never inherits the old case''s files.';
comment on column public.case_files.category is
  '#785 AC-CONV-3: file area — general | pre_class | homework | post_class. Defaults to general.';
comment on column public.case_files.file_path is
  '#785: object key inside the private `case-files` bucket. Unique per object.';
comment on column public.case_files.file_name is
  '#785: original display name for the case file list, 1-200 trimmed chars.';
comment on column public.case_files.content_type is
  '#785: MIME type recorded at upload; used to pick an icon and to validate on download.';
comment on column public.case_files.size_bytes is
  '#785 AC-CONV-5: file size in bytes, 1 .. 52428800 (50 MB hard cap; the bucket enforces the same limit).';
comment on column public.case_files.uploaded_by is
  '#785: user who uploaded the file (tutor, parent or Ops). CASCADE from auth.users.';
comment on column public.case_files.created_at is
  '#785: upload time; index order for the case file list.';

create index if not exists idx_case_files_case_created
  on public.case_files (case_id, created_at desc);
create index if not exists idx_case_files_case_category
  on public.case_files (case_id, category);

-- ---------------------------------------------------------------------------
-- Grants + RLS. Browser roles get nothing (the server fn is the only reader and
-- writer); service_role bypasses RLS and does the work.
-- ---------------------------------------------------------------------------
revoke all on public.case_files from anon, authenticated;
grant select, insert, update, delete on public.case_files to service_role;

alter table public.case_files enable row level security;

-- Explicit deny-all policies for authenticated. Unreachable while the grants
-- above are absent — kept so "RLS on, no policy" can never become a silent
-- grant-the-world default if a later migration adds privileges.
drop policy if exists case_files_deny_select on public.case_files;
create policy case_files_deny_select on public.case_files
  for select to authenticated using (false);

drop policy if exists case_files_deny_insert on public.case_files;
create policy case_files_deny_insert on public.case_files
  for insert to authenticated with check (false);

drop policy if exists case_files_deny_update on public.case_files;
create policy case_files_deny_update on public.case_files
  for update to authenticated using (false) with check (false);

drop policy if exists case_files_deny_delete on public.case_files;
create policy case_files_deny_delete on public.case_files
  for delete to authenticated using (false);
