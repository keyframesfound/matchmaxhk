-- Issue #815 §2.5 Course Showcase — close the centre-move gap in the tutor guard.
-- Additive only: one function body replacement. No drops, no renames, no RLS changes.
-- Follows 20261123110000_issue_815_course_showcase_fixes.sql, which stays as applied.

-- The previous body only re-checked when assigned_tutor_id changed, so moving a
-- course to another centre while keeping its tutor skipped validation. The
-- (tutor, centre) pairing is what approval is granted for, so validate whenever
-- either side of the pair is new — but still skip untouched re-saves, which is
-- the #815 blocker (the course form echoes assigned_tutor_id on every save).
create or replace function public.guard_course_assigned_tutor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.assigned_tutor_id is not null
     and (tg_op = 'INSERT'
          or new.assigned_tutor_id is distinct from old.assigned_tutor_id
          or new.organization_id is distinct from old.organization_id) then
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

-- trg_courses_assigned_tutor is unchanged: it already fires on
-- insert or update of (assigned_tutor_id, organization_id).
