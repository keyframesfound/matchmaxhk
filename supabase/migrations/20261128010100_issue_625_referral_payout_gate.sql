-- ---------------------------------------------------------------------------
-- #625 — referral / agent cash: base = collected take + payout gate
-- ---------------------------------------------------------------------------
-- Two rules from the 2026-11-03 CEO lock, enforced where the money moves:
--
--   1. A bounty may only become payable when the admin fee MatchMax ACTUALLY
--      collected for its source case has been received. The bounty amount is
--      already 15% of that collected fee (create_referral_bounty_on_fee), so a
--      verified drop (0.5xR) or a short package (20%) pays 15% of the reduced
--      take, never 15% of a phantom 1.5x.
--
--   2. Payout gate A or B must also hold:
--        A. Lesson 1 AND Lesson 2 are done, or
--        B. the case settled with a known final take (fee_paid / active /
--           replaced / closed), or a short package whose scheduled lessons are
--           all done.
--
-- The gate is a database trigger, not only a UI check, so the admin table,
-- a manual update, or any future surface all obey it. A waived / refunded fee
-- with no paid row left voids a pending or cleared bounty instead of leaving
-- cash owed against money that never arrived.
-- ---------------------------------------------------------------------------

create or replace function public.referral_payout_gate(_bounty_id uuid)
returns table(allowed boolean, reason text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  b            public.referral_bounties%ROWTYPE;
  v_case       uuid;
  v_legacy     integer;
  v_sor        text;
  v_status     text;
  v_short      boolean;
  v_sched      integer;
  v_fee_rows   integer;
  v_paid       numeric;
  v_collected  boolean;
  v_l1         boolean;
  v_l2         boolean;
  v_done       integer;
begin
  select * into b from public.referral_bounties where id = _bounty_id;
  if not found then
    return query select false, 'BOUNTY_NOT_FOUND'::text;
    return;
  end if;

  v_case := b.source_case_id;
  if v_case is null then
    return query select false, 'NO_SOURCE_CASE'::text;
    return;
  end if;

  -- Prefer the case_fees SoR when it has rows; fall back to the legacy mirror
  -- only for cases that never had a SoR fee row.
  select count(*), coalesce(sum(amount_hkd) filter (where status = 'paid'), 0)
    into v_fee_rows, v_paid
  from public.case_fees
  where case_id = v_case;

  select fee_amount_cents, sor_status, status, is_short_case, scheduled_lesson_count
    into v_legacy, v_sor, v_status, v_short, v_sched
  from public.tutoring_cases
  where id = v_case;
  if not found then
    return query select false, 'CASE_NOT_FOUND'::text;
    return;
  end if;

  if v_fee_rows > 0 then
    v_collected := v_paid > 0;
  else
    v_collected := coalesce(v_legacy, 0) > 0;
  end if;
  if not v_collected then
    return query select false, 'FEE_NOT_COLLECTED'::text;
    return;
  end if;

  select
    count(*) filter (where sequence = 1 and status = 'done') > 0,
    count(*) filter (where sequence = 2 and status = 'done') > 0,
    count(*) filter (where status = 'done')
    into v_l1, v_l2, v_done
  from public.case_lessons
  where case_id = v_case;

  -- Gate A: both intro lessons done.
  if v_l1 and v_l2 then
    return query select true, 'L1_L2_DONE'::text;
    return;
  end if;

  -- Gate B: settled with a known final take. 'waived' is deliberately absent:
  -- no cash was collected, so nothing is payable.
  if v_sor in ('fee_paid', 'active', 'replaced', 'closed') then
    return query select true, 'CASE_SETTLED'::text;
    return;
  end if;
  if v_status in ('closed', 'replaced') then
    return query select true, 'CASE_CLOSED'::text;
    return;
  end if;

  -- Gate B: a short package is final once every scheduled lesson is done.
  if coalesce(v_short, false)
     and coalesce(v_sched, 0) > 0
     and v_done >= v_sched then
    return query select true, 'SHORT_PACKAGE_FINISHED'::text;
    return;
  end if;

  return query select false, 'PAYOUT_GATE_NOT_MET'::text;
end;
$$;

revoke execute on function public.referral_payout_gate(uuid) from public, anon;
grant execute on function public.referral_payout_gate(uuid) to authenticated, service_role;

comment on function public.referral_payout_gate(uuid) is
  '#625: pays only when the collected admin fee exists AND (L1+L2 done OR the case settled with a known final take OR a short package finished). Returns a stable reason code.';

create or replace function public.enforce_referral_payout_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed boolean;
  v_reason  text;
begin
  if new.status in ('ready_for_payout', 'paid')
     and new.status is distinct from old.status then
    select g.allowed, g.reason into v_allowed, v_reason
    from public.referral_payout_gate(new.id) g;
    if not coalesce(v_allowed, false) then
      raise exception 'REFERRAL_GATE:%', coalesce(v_reason, 'PAYOUT_GATE_NOT_MET')
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_referral_payout_gate() from public, anon;

drop trigger if exists trg_referral_bounty_payout_gate on public.referral_bounties;
create trigger trg_referral_bounty_payout_gate
  before update of status on public.referral_bounties
  for each row execute function public.enforce_referral_payout_gate();

-- A fee that is waived or refunded with no paid row left means no cash was
-- collected: void any bounty that was still pending or cleared for payout.
create or replace function public.void_referral_bounty_on_fee_reversal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('waived', 'refunded') then
    if not exists (
      select 1 from public.case_fees f
      where f.case_id = new.case_id and f.status = 'paid'
    ) then
      update public.referral_bounties
         set status = 'voided',
             updated_at = now()
       where source_case_id = new.case_id
         and status in ('pending', 'ready_for_payout');
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.void_referral_bounty_on_fee_reversal() from public, anon;

drop trigger if exists trg_case_fees_void_referral_bounty on public.case_fees;
create trigger trg_case_fees_void_referral_bounty
  after update of status on public.case_fees
  for each row execute function public.void_referral_bounty_on_fee_reversal();

comment on column public.referral_bounties.status is
  '#625: pending = gate not met; ready_for_payout = gate passed, awaiting FPS; paid = FPS sent; voided = fee waived/refunded before collection.';
