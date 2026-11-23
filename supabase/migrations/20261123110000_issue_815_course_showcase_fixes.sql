-- Issue #815 §2.5 Course Showcase — follow-up fixes for review findings.
-- Additive only: one function body replacement, two FKs, one row-level check.
-- No drops, no renames, no data migration, no RLS policy changes.
-- Supersedes nothing in 20261123100000_issue_815_course_showcase.sql, which stays as applied.

-- 1) BLOCKER: only reject a CHANGED assignment -------------------------------
-- The course form always posts assigned_tutor_id on update, so the original
-- trigger re-validated an untouched assignment on every save and hard-failed
-- edits to unrelated fields once a tutor's affiliation had been withdrawn.
-- Re-check only when the (tutor) assignment is actually new for this row.
create or replace function public.guard_course_assigned_tutor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.assigned_tutor_id is not null
     and (tg_op = 'INSERT' or new.assigned_tutor_id is distinct from old.assigned_tutor_id) then
    if not exists (
      select 1
      from public.centre_affiliations as ca
      where ca.centre_id = new.organization_id
        and ca.user_id = new.assigned_tutor_id
        and ca.role_type = 'affiliated_tutor'
        and ca.status = 'approved'
    ) then
      raise exception 'assigned_tutor_id % is not an approved affiliated tutor of centre %',
        new.assigned_tutor_id, new.organization_id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

-- trg_courses_assigned_tutor is unchanged and still fires on
-- insert or update of (assigned_tutor_id, organization_id).

-- 2) FKs so a deleted tutor cannot leave a dangling id -----------------------
-- Both columns are new and currently all-null, so these validate immediately.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.courses'::regclass
      and conname = 'courses_assigned_tutor_fkey'
  ) then
    alter table public.courses
      add constraint courses_assigned_tutor_fkey
      foreign key (assigned_tutor_id) references public.profiles(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tutoring_cases'::regclass
      and conname = 'tutoring_cases_requested_tutor_fkey'
  ) then
    alter table public.tutoring_cases
      add constraint tutoring_cases_requested_tutor_fkey
      foreign key (requested_tutor_id) references public.profiles(id) on delete set null;
  end if;
end;
$$;

-- 3) DB-level per-highlight length cap ---------------------------------------
-- The app trims to 300 chars; direct REST writes bypass that. NULL elements are
-- treated as empty so the predicate is total over text[].
create or replace function public.course_highlights_ok(h text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(char_length(coalesce(x, '')) <= 300), true)
  from unnest(h) as x;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.courses'::regclass
      and conname = 'courses_highlights_len'
  ) then
    alter table public.courses
      add constraint courses_highlights_len
      check (public.course_highlights_ok(highlights));
  end if;
end;
$$;

-- 4) No RLS changes: no policy added, widened, narrowed or dropped.
