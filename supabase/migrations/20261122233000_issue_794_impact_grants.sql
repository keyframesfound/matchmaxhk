-- Issue #794 AC-400-4 — two desk-only capabilities, both additive.
--
--   1. `profiles.impact_account` — a staff-set marker for NGO-referred / Impact
--      accounts. The desk gates the $0 shop grant and the empty-seat offer on
--      it. Never self-set, never public.
--   2. `case_seat_grants` — one unsold seat in an existing small-group case,
--      given to a referred student, hard-capped at six seats (Cap. 279).
--
-- ADDITIVE ONLY: one column plus one guard trigger on `profiles`, one new
-- service-role table with its indexes and one cap trigger. Nothing existing is
-- dropped, renamed or rewritten.
--
-- Grants decision on `profiles` (verified against the live catalog, not assumed)
--   information_schema.role_table_grants: anon holds SELECT/INSERT/UPDATE/DELETE
--   at TABLE level; authenticated holds SELECT/INSERT/DELETE at table level but
--   NO table-level UPDATE. information_schema.column_privileges: authenticated's
--   UPDATE is granted per COLUMN (display_name, avatar_url, locale, ...) and the
--   staff-only `account_status*` columns are deliberately absent from that list.
--   has_table_privilege('authenticated','public.profiles','UPDATE') = false,
--   has_column_privilege(...,'account_status','UPDATE') = false.
--
--   Consequence for a new column: it inherits table-level SELECT (so its owner
--   can read it) and inherits no write privilege at all. Therefore:
--     - no `grant select (impact_account)` is needed — table-level SELECT covers it
--     - no UPDATE column grant is added here, and none must ever be added
--   The write side is still closed with a guard trigger rather than left to the
--   ACL alone, because authenticated DOES hold table-level INSERT: without the
--   guard a fresh profile insert could set the flag.

-- ---------------------------------------------------------------------------
-- 1. The Impact account flag
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists impact_account boolean not null default false;

comment on column public.profiles.impact_account is
  'AC-400-4: staff-set marker for NGO-referred / Impact accounts. The desk gates '
  'the $0 shop grant and the empty-seat offer on it. Never self-set: owner writes '
  'are frozen by guard_impact_account(), and authenticated holds no UPDATE '
  'privilege on this column. Never public: readable only by the owner (own row) '
  'and by staff, through the existing profiles RLS policies.';

-- ---------------------------------------------------------------------------
-- 2. The flag is not writable by its owner
-- ---------------------------------------------------------------------------
-- Mirrors guard_community_champion_mark (#400 AC-400-1) so the two marks behave
-- identically. profiles_owner_update is row-scoped only, so without this guard
-- a table-level UPDATE grant (should one ever be added) would let an owner flip
-- their own flag.
--
-- Freeze, do not raise: owner profile saves echo the whole row back, so a hard
-- exception would break every ordinary profile edit. Assigning OLD leaves the
-- write successful and the flag unmoved.
create or replace function public.guard_impact_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_staff boolean;
begin
  -- service_role, SQL (migrations, ops, backfill) and any trusted server-side
  -- write carry no JWT subject. Trusted.
  if auth.uid() is null then
    return new;
  end if;

  caller_is_staff :=
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'super_admin')
    or public.has_role(auth.uid(), 'staff');

  if caller_is_staff then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.impact_account := false;
    return new;
  end if;

  new.impact_account := coalesce(old.impact_account, false);
  return new;
end;
$$;

comment on function public.guard_impact_account() is
  'AC-400-4: an owner cannot set or clear their own profiles.impact_account. Only '
  'staff (staff/admin/super_admin), service_role and SQL migrations may move it.';

drop trigger if exists trg_guard_impact_account on public.profiles;
create trigger trg_guard_impact_account
  before insert or update on public.profiles
  for each row execute function public.guard_impact_account();

-- ---------------------------------------------------------------------------
-- 3. Empty-seat grants
-- ---------------------------------------------------------------------------
create table if not exists public.case_seat_grants (
  id uuid primary key default gen_random_uuid(),
  -- CASCADE: a purged case takes its seat grants with it. A rematch is a NEW
  -- case row, so an old case's grants never follow it.
  case_id uuid not null references public.tutoring_cases (id) on delete cascade,
  -- CASCADE: a purged student takes their grants with them.
  student_id uuid not null references public.students (id) on delete cascade,
  -- Who on the desk granted the seat. SET NULL keeps the grant if the staff
  -- account is deleted; the row still records when and on which case.
  granted_by uuid references auth.users (id) on delete set null,
  note text check (note is null or char_length(note) between 1 and 500),
  -- NULL = live seat. Set to revoke; the seat is then free again for a re-grant.
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.case_seat_grants is
  'AC-400-4: one unsold seat in an existing small-group case, granted by the desk '
  'to a referred student. Hard-capped at six seats per case including enrolled '
  'students (Cap. 279) by enforce_case_seat_grant_cap. Service-role only.';

comment on column public.case_seat_grants.case_id is
  'AC-400-4: the case whose spare seat is being given. CASCADE from tutoring_cases.';
comment on column public.case_seat_grants.student_id is
  'AC-400-4: the referred student receiving the seat. CASCADE from students.';
comment on column public.case_seat_grants.granted_by is
  'AC-400-4: the staff user who granted the seat. SET NULL if that account is deleted.';
comment on column public.case_seat_grants.note is
  'AC-400-4: optional desk note (referral source, reason), 1-500 chars.';
comment on column public.case_seat_grants.revoked_at is
  'AC-400-4: NULL = live seat. Non-NULL frees the seat and permits a fresh grant.';
comment on column public.case_seat_grants.created_at is
  'AC-400-4: when the seat was granted.';

-- One live seat per student per case. A revoked row does not block a re-grant.
create unique index if not exists uq_case_seat_grants_one_live_seat
  on public.case_seat_grants (case_id, student_id)
  where revoked_at is null;

-- Live-grant lookup for the cap check and for the case's seat roster.
create index if not exists idx_case_seat_grants_case
  on public.case_seat_grants (case_id)
  where revoked_at is null;

-- ---------------------------------------------------------------------------
-- 4. Cap enforcement — never more than six seats on a small-group case
-- ---------------------------------------------------------------------------
create or replace function public.enforce_case_seat_grant_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Cap. 279 small-group limit: a small-group tutoring case never holds more
  -- than six seats, and granted seats count against the same six as enrolled
  -- students. Single named constant on purpose — change the cap here only.
  c_seat_cap constant integer := 6;
  v_enrolled integer;
  v_grants integer;
begin
  -- Lock the case row so two concurrent grants on the same case cannot both
  -- read the same count and overshoot the cap.
  select coalesce(c.student_count, 0)
    into v_enrolled
    from public.tutoring_cases c
   where c.id = new.case_id
     for update;

  select count(*)
    into v_grants
    from public.case_seat_grants g
   where g.case_id = new.case_id
     and g.revoked_at is null;

  -- A missing case row leaves v_enrolled NULL; the FK on case_id then reports
  -- the real problem, so this check stays quiet for it.
  if coalesce(v_enrolled, 0) + v_grants >= c_seat_cap then
    raise exception
      'CAP_REACHED: case % holds % of % seats (% enrolled, % granted)',
      new.case_id, coalesce(v_enrolled, 0) + v_grants, c_seat_cap,
      coalesce(v_enrolled, 0), v_grants
      using errcode = 'P0001',
            hint = 'Revoke an unused seat grant, or free an enrolled seat, first.';
  end if;

  return new;
end;
$$;

comment on function public.enforce_case_seat_grant_cap() is
  'AC-400-4: refuses a case_seat_grants insert when enrolled + live granted seats '
  'already reach the six-seat small-group cap (Cap. 279). Raises CAP_REACHED.';

drop trigger if exists trg_enforce_case_seat_grant_cap on public.case_seat_grants;
create trigger trg_enforce_case_seat_grant_cap
  before insert on public.case_seat_grants
  for each row execute function public.enforce_case_seat_grant_cap();

-- ---------------------------------------------------------------------------
-- 5. Grants + RLS — service-role only, exactly like case_files
-- ---------------------------------------------------------------------------
-- pg_default_acl hands every new public table full privileges to anon and
-- authenticated, so this REVOKE is what actually closes the table. Browser
-- roles get nothing; the desk's server fns use the service role and resolve the
-- caller against the case themselves.
revoke all on public.case_seat_grants from anon, authenticated;
grant select, insert, update, delete on public.case_seat_grants to service_role;

alter table public.case_seat_grants enable row level security;

-- Explicit deny-all policies. Unreachable while the grants above are absent —
-- kept so "RLS on, no policy" can never become a silent grant-the-world default
-- if a later migration adds privileges.
drop policy if exists case_seat_grants_deny_select on public.case_seat_grants;
create policy case_seat_grants_deny_select on public.case_seat_grants
  for select to authenticated using (false);

drop policy if exists case_seat_grants_deny_insert on public.case_seat_grants;
create policy case_seat_grants_deny_insert on public.case_seat_grants
  for insert to authenticated with check (false);

drop policy if exists case_seat_grants_deny_update on public.case_seat_grants;
create policy case_seat_grants_deny_update on public.case_seat_grants
  for update to authenticated using (false) with check (false);

drop policy if exists case_seat_grants_deny_delete on public.case_seat_grants;
create policy case_seat_grants_deny_delete on public.case_seat_grants
  for delete to authenticated using (false);
