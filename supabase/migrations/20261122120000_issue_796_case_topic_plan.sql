-- Issue #796 §2.1 (was #740) — planned syllabus topics per case.
--
-- ADDITIVE ONLY: one new table, its index, one guard function + trigger, and
-- grants. Nothing existing is altered. Prior migration history is untouched.
--
-- Why this table exists
--   The #796 heatmap derives "Not Covered" (grey / 未教授) pills from the union of
--   (a) topics the tutor already logged in case_lesson_logs.topics and (b) topics
--   the parent/student flagged in case_topic_flags. What was still missing is the
--   *plan*: the list of topics a case intends to cover, so grey pills can appear
--   before any tutor ever logs them.
--
--   Preset suggestions are DERIVED, not authored: the server fn lists topic tags
--   already logged on other cases in the same subject and offers those as pills
--   the tutor can add. There are no curriculum tables and no seeded lists. This
--   table stores only the choices actually made.
--
-- Model
--   case_topic_plan  one row per planned topic of a case. `unique (case_id, topic)`
--                    makes "add this pill" idempotent and the cap countable.
--                    Removing a planned topic deletes the row.
--
-- Cap
--   30 planned topics per case (owner decision, #796 §2.1 "a sensible cap").
--   Enforced by a BEFORE INSERT trigger rather than the server fn alone, so two
--   concurrent writers cannot both slip under the limit: the trigger takes a
--   per-case transaction advisory lock, then counts. It raises 'TOPIC_CAP' as the
--   message so the server fn can map it to a friendly error without parsing text.
--
-- Visibility (never browser-direct)
--   Tutor + Ops write, parent/student read-only, and both go through service-role
--   server fns that resolve the caller against the case first. There is
--   deliberately NO grant to anon/authenticated: pg_default_acl would otherwise
--   hand every browser role full privileges on a new public table, so the REVOKE
--   below is what protects it. RLS stays enabled with deny-all policies so the
--   table is never an accidental open surface if a grant is added later.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.case_topic_plan (
  id uuid primary key default gen_random_uuid(),
  -- CASCADE: a purged case takes its plan with it. A rematch is a new case row,
  -- so an old plan never leaks into the new case's heatmap.
  case_id uuid not null references public.tutoring_cases (id) on delete cascade,
  -- Syllabus #tag, same vocabulary as the #767 drawer / #740 heatmap. Casing is
  -- whatever the tutor added; comparisons in the server fn are case-insensitive,
  -- so `unique (case_id, topic)` is enforced on the literal text.
  topic text not null check (char_length(btrim(topic)) between 1 and 80),
  -- Who added the pill (tutor, or an Ops user acting for them).
  added_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint case_topic_plan_case_topic_key unique (case_id, topic)
);

comment on table public.case_topic_plan is
  '#796 §2.1 planned syllabus topics for a case (grey "Not Covered" until a Super-Drawer log covers them); tutor + Ops write, parent/student read-only; service-role only, never public.';

comment on column public.case_topic_plan.case_id is
  '#796: the case whose syllabus plan this row belongs to. CASCADE from tutoring_cases.';
comment on column public.case_topic_plan.topic is
  '#796: syllabus #tag the case plans to cover, 1-80 chars trimmed. unique per case.';
comment on column public.case_topic_plan.added_by is
  '#796: tutor or Ops user who added this planned topic.';
comment on column public.case_topic_plan.created_at is
  '#796: when the planned topic was added; index order for the plan list.';

create index if not exists idx_case_topic_plan_case
  on public.case_topic_plan (case_id, created_at);

-- ---------------------------------------------------------------------------
-- 30-per-case cap, enforced in the database.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_case_topic_plan_cap()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  planned integer;
begin
  -- Serialise concurrent writers for this case so two inserts at 29 planned
  -- topics cannot both pass the count. Lock is transaction-scoped: released on
  -- commit/rollback, so it never blocks unrelated cases.
  perform pg_advisory_xact_lock(hashtext('case_topic_plan:' || new.case_id::text));

  select count(*) into planned
  from public.case_topic_plan
  where case_id = new.case_id;

  if planned >= 30 then
    raise exception 'TOPIC_CAP' using
      errcode = '23514',
      detail = 'case_topic_plan allows at most 30 planned topics per case';
  end if;
  return new;
end;
$$;

comment on function public.enforce_case_topic_plan_cap() is
  '#796 §2.1: raises TOPIC_CAP when a case already plans 30 syllabus topics. Takes a per-case advisory lock so concurrent writers cannot exceed the cap.';

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_enforce_case_topic_plan_cap'
      and tgrelid = 'public.case_topic_plan'::regclass
  ) then
    create trigger trg_enforce_case_topic_plan_cap
      before insert on public.case_topic_plan
      for each row execute function public.enforce_case_topic_plan_cap();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Grants + RLS. Browser roles get nothing (the server fn is the only reader and
-- writer); service_role bypasses RLS and does the work.
-- ---------------------------------------------------------------------------
revoke all on public.case_topic_plan from anon, authenticated;
grant select, insert, update, delete on public.case_topic_plan to service_role;

alter table public.case_topic_plan enable row level security;

-- Explicit deny-all policies for authenticated. Unreachable while the grants
-- above are absent — kept so "RLS on, no policy" can never become a silent
-- grant-the-world default if a later migration adds privileges.
drop policy if exists case_topic_plan_deny_select on public.case_topic_plan;
create policy case_topic_plan_deny_select on public.case_topic_plan
  for select to authenticated using (false);

drop policy if exists case_topic_plan_deny_insert on public.case_topic_plan;
create policy case_topic_plan_deny_insert on public.case_topic_plan
  for insert to authenticated with check (false);

drop policy if exists case_topic_plan_deny_update on public.case_topic_plan;
create policy case_topic_plan_deny_update on public.case_topic_plan
  for update to authenticated using (false) with check (false);

drop policy if exists case_topic_plan_deny_delete on public.case_topic_plan;
create policy case_topic_plan_deny_delete on public.case_topic_plan
  for delete to authenticated using (false);
