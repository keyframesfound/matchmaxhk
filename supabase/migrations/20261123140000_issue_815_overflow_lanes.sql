-- Issue #815 §2.11: Partner Org lanes for tutoring_cases.
--
-- Two lanes ride on the same demand row without a second table:
--   centre_overflow  — a Partner Centre's own request overflowing into the board
--   parent_referral  — a parent/community referral with an attributed net rate
--
-- Additive only: three nullable columns, two check constraints, one partial
-- index. No RLS policy change, no trigger, no data backfill, no drops.
-- Rows that predate this migration keep overflow_lane = null and are
-- untouched by the new index predicate and constraints.

alter table public.tutoring_cases
  add column if not exists overflow_lane text,
  add column if not exists net_rate_hkd integer,
  add column if not exists referred_by_organization_id uuid
    references public.organizations(id) on delete set null;

comment on column public.tutoring_cases.overflow_lane is
  'Partner Org lane: centre_overflow | parent_referral. Null = ordinary demand row.';
comment on column public.tutoring_cases.net_rate_hkd is
  'Attributed net rate in HKD for the lane (what the introducer nets, not the parent price).';
comment on column public.tutoring_cases.referred_by_organization_id is
  'Partner Centre that referred this case, when the lane is a centre referral.';

-- Constraints are added inside guards so the migration is safe to re-run.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tutoring_cases_overflow_lane_check'
      and conrelid = 'public.tutoring_cases'::regclass
  ) then
    alter table public.tutoring_cases
      add constraint tutoring_cases_overflow_lane_check
      check (overflow_lane is null or overflow_lane in ('centre_overflow', 'parent_referral'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'tutoring_cases_net_rate_check'
      and conrelid = 'public.tutoring_cases'::regclass
  ) then
    alter table public.tutoring_cases
      add constraint tutoring_cases_net_rate_check
      check (net_rate_hkd is null or (net_rate_hkd >= 0 and net_rate_hkd <= 100000));
  end if;
end
$$;

-- Active centre-overflow queue per organisation. Terminal statuses are excluded
-- so the index stays small and serves the "what is still waiting" read.
create index if not exists idx_tutoring_cases_overflow_active
  on public.tutoring_cases(organisation_id)
  where overflow_lane = 'centre_overflow'
    and status not in ('matched', 'closed', 'rejected', 'released');
