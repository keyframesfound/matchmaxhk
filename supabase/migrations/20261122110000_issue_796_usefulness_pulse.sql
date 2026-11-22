-- Issue #796 §2.4 (formerly #733) — private lesson usefulness pulse.
--
-- ADDITIVE ONLY: one new table plus its indexes, trigger and grants. Nothing
-- existing is altered — in particular this table is deliberately NOT
-- `case_reviews` (#794 public ratings). A public rating is marketing content
-- shown to future parents; this pulse is confidential feedback the parent or
-- student gives at milestone lessons (5, 10, 15, …) and is shown to nobody but
-- Ops. Keeping them apart means a tutor can never see, and a public profile can
-- never render, a "needs_adjustment" answer.
--
-- Model
--   case_usefulness_pulses  one row per (case, account, milestone_lesson).
--                           The case parent account (`tutoring_cases.parent_id`)
--                           and a student account (`students.owner_user_id` for
--                           `tutoring_cases.student_id`) are separate accounts,
--                           so each gets its own row and its own prompt; one
--                           answering never writes or overwrites the other.
--                           `unique (case_id, account_id, milestone_lesson)`
--                           makes a re-submit idempotent per person.
--                           `flagged_for_ops` is generated, not stored twice:
--                           a "needs_adjustment" verdict is the only thing that
--                           raises the Ops flag, so the two can never disagree.
--
-- Visibility (never browser-direct)
--   Service-role server fns only. There is deliberately NO grant to
--   anon/authenticated and no permissive policy: pg_default_acl would otherwise
--   hand every browser role full privileges on a new public table, so the
--   REVOKE below is what protects it. RLS stays enabled with deny-all policies
--   so the table is never an accidental open surface if a grant is added later.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.case_usefulness_pulses (
  id uuid primary key default gen_random_uuid(),
  -- CASCADE: a purged case takes its pulses with it. A rematch is a new case
  -- row, so an earlier pulse never carries into the new case.
  case_id uuid not null references public.tutoring_cases (id) on delete cascade,
  -- The person answering: the case parent account, or the student account
  -- (students.owner_user_id). CASCADE: a deleted auth user takes their answers.
  account_id uuid not null references auth.users (id) on delete cascade,
  -- Which side of the case this account speaks for. The server fn resolves the
  -- caller (parent vs student owner) before writing; this column makes the
  -- answer readable without re-deriving the role later.
  respondent_role text not null check (respondent_role in ('parent', 'student')),
  -- Milestone lessons only: 5, 10, 15, … A non-multiple or a lesson below the
  -- first milestone is not a pulse point.
  milestone_lesson integer not null
    check (milestone_lesson >= 5 and milestone_lesson % 5 = 0),
  verdict text not null check (verdict in ('very_useful', 'okay', 'needs_adjustment')),
  -- Optional free-form pills ("pacing", "homework load", …). Empty by default;
  -- the server fn normalises/trims before insert.
  tags text[] not null default '{}',
  -- Generated, never written by the client: only "needs_adjustment" raises the
  -- private Ops flag. Stored so the partial index below is a plain boolean read.
  flagged_for_ops boolean not null generated always as (verdict = 'needs_adjustment') stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_usefulness_pulses_key unique (case_id, account_id, milestone_lesson)
);

comment on table public.case_usefulness_pulses is
  '#733/#796 §2.4 confidential lesson usefulness pulse: one parent/student answer per (case, account, milestone lesson). Service-role only; never shown to tutors and never merged into the #794 public case_reviews ratings.';

comment on column public.case_usefulness_pulses.flagged_for_ops is
  '#733/#796 §2.4 private Ops flag: generated true only when verdict = ''needs_adjustment''. Service-role only; never a public signal.';

create index if not exists idx_case_usefulness_pulses_case_milestone
  on public.case_usefulness_pulses (case_id, milestone_lesson);

create index if not exists idx_case_usefulness_pulses_flagged
  on public.case_usefulness_pulses (case_id)
  where flagged_for_ops;

-- ---------------------------------------------------------------------------
-- updated_at touch (same shape as the #767 super-drawer trigger)
-- ---------------------------------------------------------------------------
create or replace function public.case_usefulness_pulses_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_case_usefulness_pulses_touch on public.case_usefulness_pulses;
create trigger trg_case_usefulness_pulses_touch before update on public.case_usefulness_pulses
  for each row execute function public.case_usefulness_pulses_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Grants + RLS. Browser roles get nothing (the server fn is the only reader and
-- writer); service_role bypasses RLS and does the work.
-- ---------------------------------------------------------------------------
revoke all on public.case_usefulness_pulses from anon, authenticated;
grant select, insert, update, delete on public.case_usefulness_pulses to service_role;

alter table public.case_usefulness_pulses enable row level security;

-- Explicit deny-all policies for authenticated. Unreachable while the grants
-- above are absent — kept so "RLS on, no policy" can never become a silent
-- grant-the-world default if a later migration adds privileges.
drop policy if exists case_usefulness_pulses_deny_select on public.case_usefulness_pulses;
create policy case_usefulness_pulses_deny_select on public.case_usefulness_pulses
  for select to authenticated using (false);

drop policy if exists case_usefulness_pulses_deny_insert on public.case_usefulness_pulses;
create policy case_usefulness_pulses_deny_insert on public.case_usefulness_pulses
  for insert to authenticated with check (false);

drop policy if exists case_usefulness_pulses_deny_update on public.case_usefulness_pulses;
create policy case_usefulness_pulses_deny_update on public.case_usefulness_pulses
  for update to authenticated using (false) with check (false);

drop policy if exists case_usefulness_pulses_deny_delete on public.case_usefulness_pulses;
create policy case_usefulness_pulses_deny_delete on public.case_usefulness_pulses
  for delete to authenticated using (false);
