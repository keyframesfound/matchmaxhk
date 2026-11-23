-- Issue #815 §2.11 (AC-OV-3): make the 3-active-overflow cap atomic in the database.
--
-- Before this migration the cap lived only in app code: submitCentreCaseRequest
-- counted active lane-A rows and then inserted. Two concurrent submits both read
-- 2 and both inserted, so an org could hold 4+ active overflow cases.
--
-- The cap now lives on the organisation row as a counter, moved by a BEFORE
-- trigger on tutoring_cases with a conditional UPDATE ... WHERE counter < 3.
-- Under READ COMMITTED the second writer blocks on the org row lock and, once
-- granted, re-checks the predicate against the newest row version, so the
-- compare-and-set is atomic without a serializable transaction or an advisory
-- lock. A failed compare-and-set raises the sanctioned message with 23514.
--
-- Additive only: one column with a default, one backfill, two trigger functions,
-- two triggers, one check constraint. No RLS policy change, no column or policy
-- drops.
--
-- Two triggers, because the counter is an invariant in both directions:
--   trg_overflow_cap                  keeps it in step with tutoring_cases
--   trg_organizations_guard_overflow_counter stops an org admin from writing it
-- The second exists because the existing UPDATE policy on organizations is
-- table-wide (is_org_admin(id) OR is_platform_admin()) and
-- protect_org_managed_columns() covers only plan/status/slug/created_by, so
-- without it the constrained user could PATCH overflow_active_count back to 0
-- and bypass the cap with one PostgREST call.
--
-- Note: moving the counter fires trg_organizations_updated_at, so an
-- organisation's updated_at advances when its overflow queue changes. That is
-- harmless and not read as a business timestamp.

-- 1. The counter. Default 0 keeps existing rows valid without a rewrite.
alter table public.organizations
  add column if not exists overflow_active_count integer not null default 0;

comment on column public.organizations.overflow_active_count is
  'Issue #815 §2.11: cache of active lane-A (centre_overflow) cases for this org, maintained by trg_overflow_cap. Cap is 3; never written by app code.';

-- 2. Backfill from the authoritative rows, so the cache starts truthful.
-- Terminal statuses match src/features/cases/overflow-lane.ts countsAsActiveOverflow.
update public.organizations o
set overflow_active_count = (
  select count(*)::integer
  from public.tutoring_cases c
  where c.organisation_id = o.id
    and c.overflow_lane = 'centre_overflow'
    and c.status::text not in ('matched', 'closed', 'rejected', 'released')
);

-- 3. One trigger function for INSERT / UPDATE / DELETE.
create or replace function public.guard_overflow_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  terminal constant text[] := array['matched', 'closed', 'rejected', 'released'];
  old_active boolean := false;
  new_active boolean := false;
  old_org uuid;
  new_org uuid;
  need_release boolean := false;
  need_acquire boolean := false;
  acquired boolean := false;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    old_active := coalesce(old.overflow_lane = 'centre_overflow', false)
      and not (old.status::text = any (terminal));
    old_org := old.organisation_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    new_active := coalesce(new.overflow_lane = 'centre_overflow', false)
      and not (new.status::text = any (terminal));
    new_org := new.organisation_id;
  end if;

  -- Release the old org when the row leaves the active set, is deleted, or moves org.
  need_release := old_active
    and (tg_op = 'DELETE' or old_org is distinct from new_org or not new_active);

  -- Acquire on the new org when the row enters the active set or moves org.
  need_acquire := new_active
    and (tg_op = 'INSERT' or old_org is distinct from new_org or not old_active);

  if need_release and old_org is not null then
    -- Transaction-local flag: tells trg_organizations_guard_overflow_counter that
    -- this write is the database's own bookkeeping, not a client edit.
    perform set_config('matchmax.overflow_cap_write', 'on', true);
    update public.organizations
       set overflow_active_count = greatest(overflow_active_count - 1, 0)
     where id = old_org;
    perform set_config('matchmax.overflow_cap_write', '', true);
  end if;

  if need_acquire and new_org is not null then
    -- The compare-and-set: no row updated means the cap is already reached.
    perform set_config('matchmax.overflow_cap_write', 'on', true);
    update public.organizations
       set overflow_active_count = overflow_active_count + 1
     where id = new_org
       and overflow_active_count < 3;
    acquired := found; -- captured before any other statement can reset FOUND
    perform set_config('matchmax.overflow_cap_write', '', true);

    if not acquired then
      raise exception 'You already have 3 active overflow cases. Close one before posting another.'
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function public.guard_overflow_cap() is
  'Issue #815 §2.11 (AC-OV-3): atomic 3-active-overflow cap per organisation. Conditional UPDATE on organizations.overflow_active_count is the compare-and-set.';

-- 4. Fire only on the columns that can change membership of the active set.
drop trigger if exists trg_overflow_cap on public.tutoring_cases;
create trigger trg_overflow_cap
  before insert or update of overflow_lane, status, organisation_id or delete
  on public.tutoring_cases
  for each row
  execute function public.guard_overflow_cap();

-- 5. The counter is database-owned: a client that holds the organizations UPDATE
-- policy must not be able to move it. Invoker rights so current_user is the real
-- request role; the GUC set by guard_overflow_cap() whitelists its own writes.
create or replace function public.guard_org_overflow_counter()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.overflow_active_count is distinct from old.overflow_active_count
     and coalesce(current_setting('matchmax.overflow_cap_write', true), '') <> 'on'
     and current_user not in ('postgres', 'supabase_admin', 'service_role')
     and coalesce(auth.role(), '') <> 'service_role'
  then
    raise exception 'overflow_active_count is maintained by the database and cannot be edited directly'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

comment on function public.guard_org_overflow_counter() is
  'Issue #815 §2.11 (AC-OV-3): rejects client writes to organizations.overflow_active_count; only guard_overflow_cap() (via a transaction-local flag) and service-role/SQL contexts may move it.';

drop trigger if exists trg_organizations_guard_overflow_counter on public.organizations;
create trigger trg_organizations_guard_overflow_counter
  before update of overflow_active_count
  on public.organizations
  for each row
  execute function public.guard_org_overflow_counter();

-- 6. Invariant, added last so the backfill can settle first. Guarded for re-runs.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'organizations_overflow_active_count_check'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_overflow_active_count_check
      check (overflow_active_count >= 0 and overflow_active_count <= 3);
  end if;
end
$$;
