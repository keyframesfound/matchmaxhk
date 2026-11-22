-- Issue #796 §2.1 — Syllabus Topic Mastery Heatmap.
--
-- ADDITIVE ONLY: one new table plus its indexes and grants. Nothing existing is
-- altered. The heatmap is an aggregation (server fn: heatmap.functions.ts) over
-- the #767 Super-Drawer's `case_lesson_logs.topics`
-- ([{ tag, mastery: weak | practicing | mastered | null }]) and the #796 §2.2
-- mistake book's unresolved `case_mistakes.topic_tag` rows. This table only
-- holds the parent/student "flag for help" overlay — one row per (case, topic).
--
-- Model
--   case_topic_flags  one row while a parent or the student has asked for help
--                     on a syllabus topic of this case. Unflagging deletes the
--                     row, so the UI's `flagged` boolean is just "row exists".
--                     `unique (case_id, topic)` makes flagging idempotent.
--
-- Visibility (never browser-direct)
--   Service-role server fns only. The heatmap read resolves the caller against
--   the case (parent / student owner / matched tutor / Ops) before touching
--   this table, and the flag write refuses anyone who is not the parent or the
--   student owner. There is deliberately NO grant to anon/authenticated and no
--   permissive policy: pg_default_acl would otherwise hand every browser role
--   full privileges on a new public table, so the REVOKE below is what protects
--   it. RLS stays enabled with deny-all policies so the table is never an
--   accidental open surface if a grant is added later.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.case_topic_flags (
  id uuid primary key default gen_random_uuid(),
  -- CASCADE: a purged case takes its flags with it. A rematch is a new case
  -- row, so earlier flags never leak into the new case's heatmap.
  case_id uuid not null references public.tutoring_cases (id) on delete cascade,
  -- Syllabus #tag, same vocabulary as the #767 drawer / #740 heatmap. Casing is
  -- the display casing the parent clicked; comparisons in the server fn are
  -- case-insensitive.
  topic text not null check (char_length(btrim(topic)) between 1 and 80),
  flagged_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint case_topic_flags_case_topic_key unique (case_id, topic)
);

comment on table public.case_topic_flags is
  '#796 §2.1 Syllabus Topic Mastery Heatmap: parent/student "flag for help" on one topic of a case. Service-role only; never public.';

create index if not exists idx_case_topic_flags_case
  on public.case_topic_flags (case_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Grants + RLS. Browser roles get nothing (the server fn is the only reader and
-- writer); service_role bypasses RLS and does the work.
-- ---------------------------------------------------------------------------
revoke all on public.case_topic_flags from anon, authenticated;
grant select, insert, update, delete on public.case_topic_flags to service_role;

alter table public.case_topic_flags enable row level security;

-- Explicit deny-all policies for authenticated. Unreachable while the grants
-- above are absent — kept so "RLS on, no policy" can never become a silent
-- grant-the-world default if a later migration adds privileges.
drop policy if exists case_topic_flags_deny_select on public.case_topic_flags;
create policy case_topic_flags_deny_select on public.case_topic_flags
  for select to authenticated using (false);

drop policy if exists case_topic_flags_deny_insert on public.case_topic_flags;
create policy case_topic_flags_deny_insert on public.case_topic_flags
  for insert to authenticated with check (false);

drop policy if exists case_topic_flags_deny_update on public.case_topic_flags;
create policy case_topic_flags_deny_update on public.case_topic_flags
  for update to authenticated using (false) with check (false);

drop policy if exists case_topic_flags_deny_delete on public.case_topic_flags;
create policy case_topic_flags_deny_delete on public.case_topic_flags
  for delete to authenticated using (false);
