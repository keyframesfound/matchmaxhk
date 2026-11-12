-- Issue #760 Part 1 (was #615) — attendance-tied admin-fee milestone ledger.
--
-- Founder lock (#612 Q3, packed into #760): on a MATCHMAX_MATCHED
-- engagement, PRESENT/LATE attendance AUTO-STAMPS fee milestones in the
-- admin ledger (100% of Lesson 1 + 50% of Lesson 2 for standard ongoing;
-- the 20% short-course fee for declared ≤5-lesson engagements). Ledger
-- status only — this table NEVER moves money; collection stays the
-- existing desk process (#475 Phase 0). SELF_BROUGHT students get no
-- milestone rows at all (HK$0 matching commission).
--
-- One row per (case, milestone kind). The stamping/reverting writer is the
-- shared server-side sync (src/features/cases/fee-milestones.server.ts)
-- called from the roster attendance fns (#613 save/edit/void) and the
-- case_lessons attendance fns (#533 recordAttendance / desk lessonAdminMark).
-- Voiding attendance inside the 24h correction window flips a delivered
-- milestone back to pending (delivered_at cleared); a delivered milestone
-- never DELETES an already-invoiced fee row — invoice reconciliation stays
-- a human desk action.
--
-- Amounts are HKD snapshots at stamp time (same whole-HKD helpers the desk
-- invoices with: fee-breakdown.ts × lesson count; short-case.ts × package).
create table if not exists public.case_fee_milestones (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.tutoring_cases (id) on delete cascade,
  kind text not null check (kind in ('lesson_1_100', 'lesson_2_50', 'short_course_20')),
  status text not null default 'pending' check (status in ('pending', 'delivered')),
  amount_hkd numeric(10, 2) check (amount_hkd is null or amount_hkd >= 0),
  delivered_at timestamptz,
  delivered_source text check (delivered_source in ('roster_attendance', 'case_lesson')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, kind)
);

create index if not exists case_fee_milestones_case_idx
  on public.case_fee_milestones (case_id);

-- A delivered milestone always carries its instant and its source; a
-- pending one carries neither (same pairing rule the short-case confirm
-- columns use).
alter table public.case_fee_milestones add constraint case_fee_milestones_delivered_pair_chk
  check (
    (status = 'delivered' AND delivered_at IS NOT NULL AND delivered_source IS NOT NULL)
    OR (status = 'pending' AND delivered_at IS NULL AND delivered_source IS NULL)
  );

-- #760 Part 1 is admin-fee INTERNAL state (tutor-side money fields must
-- never reach parents). Deny-by-default: no anon/authenticated grants at
-- all — tutor and desk reads go through party-checked server fns on the
-- service-role client, exactly like case_fees. RLS enabled on top of the
-- empty grant set so the pg_default_acl pattern cannot re-open it.
alter table public.case_fee_milestones enable row level security;

do $$
begin
  execute format('revoke all on public.case_fee_milestones from anon, authenticated');
  execute format('grant select, insert, update, delete on public.case_fee_milestones to service_role');
end $$;

comment on table public.case_fee_milestones is
  '#760 Part 1 attendance-tied admin-fee milestone ledger: L1 100% / L2 50% / short-course 20% delivery evidence with delivered_at timestamps. Ledger status only — never collects money. Service-role only; parents have no grant and no policy.';
comment on column public.case_fee_milestones.kind is
  'lesson_1_100 = 100% of Lesson 1 (standard ongoing), lesson_2_50 = 50% of Lesson 2, short_course_20 = the 20% fee of a declared 1-5 lesson engagement.';
comment on column public.case_fee_milestones.delivered_source is
  'Which attendance surface stamped delivery: #613 roster attendance or the #533 case_lessons attendance mark.';
