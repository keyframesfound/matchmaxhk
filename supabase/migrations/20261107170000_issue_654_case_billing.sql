-- #654 Schedule & Billing. Contested reschedule requests (Propose -> Accept)
-- and shared paid status for the tuition statement. Bookkeeping only: nothing
-- here moves money. RLS-deny; access through party-checked server fns.
create table if not exists public.case_reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.tutoring_cases(id) on delete cascade,
  lesson_id uuid not null references public.case_lessons(id) on delete cascade,
  proposed_starts_at timestamptz not null,
  note text check (char_length(note) <= 200),
  proposed_by uuid not null,
  proposer_role text not null check (proposer_role in ('tutor', 'parent')),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'superseded')),
  responded_by uuid,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

-- One open proposal per lesson; a new one replaces the old.
create unique index if not exists case_reschedule_one_pending_uq
  on public.case_reschedule_requests (lesson_id)
  where status = 'pending';
create index if not exists idx_case_reschedule_case
  on public.case_reschedule_requests (case_id, status);

create table if not exists public.case_statement_months (
  case_id uuid not null references public.tutoring_cases(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'partial')),
  note text check (char_length(note) <= 200),
  marked_by uuid,
  marked_by_role text check (marked_by_role in ('tutor', 'parent')),
  marked_at timestamptz,
  shared_at timestamptz,
  primary key (case_id, month)
);

do $$
declare t text;
begin
  foreach t in array array['case_reschedule_requests', 'case_statement_months'] loop
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

comment on table public.case_reschedule_requests is
  '#654 contested reschedule: the counterparty accepts or declines. Agreed moves use #636 self-edit.';
comment on table public.case_statement_months is
  '#654 shared paid status per statement month, with who marked it. Bookkeeping only, no money moves.';
