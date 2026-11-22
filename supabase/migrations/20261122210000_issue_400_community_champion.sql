-- Issue #794 AC-400-1 — a tutor earns the Community Champion mark by teaching a
-- pro-bono case that actually ran: the case reaches `closed` with at least one
-- lesson in `done`. It is never a toggle, never self-claimed, never set by a
-- profile save.
--
-- ADDITIVE ONLY: one nullable column on `tutors`, one award function, one
-- trigger on `tutoring_cases`, one owner-write guard on `tutors`, one backfill.
-- No new table, no RLS change, no existing column touched.
--
-- Why a trigger, not a code hook
--   Staff close a case through several paths (parent end-case, tutor end-case,
--   desk status change). Every one of them lands as an UPDATE of
--   `tutoring_cases.sor_status`, so a trigger on that column is the single point
--   that cannot be bypassed by a new call site.
--
-- `'replaced'` is not completion
--   `sor_status = 'replaced'` means the case was rematched, so the tutor who
--   taught the replaced case did not finish anything. Only `'closed'` counts.
--
-- Grants
--   `public.tutors` is granted at TABLE level to anon/authenticated
--   (information_schema.table_privileges: anon + authenticated both hold
--   SELECT/INSERT/UPDATE/DELETE/... on the table), so a new column is already
--   readable and writable by those roles without a column grant. That is the
--   opposite of `public.tutoring_cases`, which is granted per COLUMN (125
--   column rows, no table-level SELECT for anon/authenticated) and needed an
--   explicit `grant select (meeting_url)` in #785. Hence: no grant here, and
--   the write side is closed with a guard trigger instead (see section 3).
--
-- Backfill
--   Awards tutors who already satisfy the rule. Production currently has zero
--   pro-bono cases, so this updates zero rows; it exists so an environment that
--   closed a pro-bono case before this migration is not left unmarked.

-- ---------------------------------------------------------------------------
-- 1. The mark
-- ---------------------------------------------------------------------------
alter table public.tutors
  add column if not exists community_champion_at timestamptz;

comment on column public.tutors.community_champion_at is
  'AC-400-1: awarded automatically when a pro-bono case of this tutor reaches '
  'sor_status = closed with at least one case_lessons row in status = done. '
  'Never self-claimed: no tutor-facing toggle, and owner writes cannot move it '
  '(guard_community_champion_mark). NULL = no mark.';

-- ---------------------------------------------------------------------------
-- 2. Award on case close
-- ---------------------------------------------------------------------------
create or replace function public.award_community_champion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_sub text := current_setting('request.jwt.claim.sub', true);
  saved_claims text := current_setting('request.jwt.claims', true);
begin
  if new.sor_status is distinct from 'closed'
     or new.package_type is distinct from 'pro_bono'
     or new.matched_tutor_id is null
     or not exists (
       select 1
       from public.case_lessons l
       where l.case_id = new.id
         and l.status = 'done'
     )
  then
    return new;
  end if;

  -- The mark is write-once: coalesce keeps the first award date if a tutor has
  -- more than one qualifying pro-bono case.
  --
  -- This is a SYSTEM write, not an owner edit. The owner-write guards on
  -- `tutors` branch on auth.uid(), so masking the request JWT for the duration
  -- of the UPDATE makes them treat it as a trusted service-side write. Without
  -- the mask, a parent closing the case trips
  -- tutors_owner_enforcement_guard('account is not active') for any tutor row
  -- with no user account (127 of 143 today) and the case close itself fails.
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);

  begin
    update public.tutors
       set community_champion_at = coalesce(community_champion_at, now())
     where id = new.matched_tutor_id;
  exception when others then
    -- A badge must never abort the case close it was awarded from.
    raise warning 'community champion award skipped for tutor %: %',
      new.matched_tutor_id, sqlerrm;
  end;

  perform set_config('request.jwt.claim.sub', coalesce(saved_sub, ''), true);
  perform set_config('request.jwt.claims', coalesce(saved_claims, ''), true);

  return new;
end;
$$;

comment on function public.award_community_champion() is
  'AC-400-1 trigger body: marks the matched tutor when a pro-bono case closes '
  'with at least one done lesson. Write-once.';

drop trigger if exists trg_award_community_champion on public.tutoring_cases;
create trigger trg_award_community_champion
  after update of sor_status on public.tutoring_cases
  for each row execute function public.award_community_champion();

-- ---------------------------------------------------------------------------
-- 3. The mark is not writable by a tutor
-- ---------------------------------------------------------------------------
-- `public.tutors` is granted UPDATE at table level to `authenticated`, and RLS
-- (`tutors_owner_update`) is row-scoped, not column-scoped. Without this guard a
-- tutor could PATCH their own row and set community_champion_at — exactly the
-- self-claim AC-400-1 forbids, and the same hole already closed for
-- verification_tier/tutor_status/is_fast_responder in tutors_owner_verified_guard.
--
-- Freeze rather than raise: owner profile saves echo the whole row back, so a
-- hard exception would break honest clients. Assigning OLD leaves the write
-- successful and the mark unmoved.
create or replace function public.guard_community_champion_mark()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_staff boolean;
begin
  -- service_role, SQL (migrations, ops, backfill), and the award trigger, which
  -- masks the request JWT while it writes. Trusted.
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
    new.community_champion_at := null;
    return new;
  end if;

  if new.community_champion_at is distinct from old.community_champion_at then
    new.community_champion_at := old.community_champion_at;
  end if;

  return new;
end;
$$;

comment on function public.guard_community_champion_mark() is
  'AC-400-1: a tutor cannot set or clear their own community_champion_at. Only '
  'award_community_champion(), staff, and service_role may move it.';

drop trigger if exists trg_guard_community_champion_mark on public.tutors;
create trigger trg_guard_community_champion_mark
  before insert or update on public.tutors
  for each row execute function public.guard_community_champion_mark();

-- ---------------------------------------------------------------------------
-- 4. Backfill
-- ---------------------------------------------------------------------------
update public.tutors t
   set community_champion_at = now()
 where t.community_champion_at is null
   and exists (
     select 1
     from public.tutoring_cases c
     join public.case_lessons l on l.case_id = c.id
     where c.matched_tutor_id = t.id
       and c.package_type = 'pro_bono'
       and c.sor_status = 'closed'
       and l.status = 'done'
   );
