-- #782 §2.5 (was #703): private pre-lesson behaviour reports + concierge
-- strikes. Ops only: RLS on with no policies (service role server fns);
-- never shown on public cards or parent profiles. Additive only.

create table if not exists public.behaviour_reports (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.tutoring_cases(id) on delete cascade,
  subject_role text not null check (subject_role in ('parent', 'tutor')),
  subject_account_id uuid references auth.users(id) on delete set null,
  category text not null
    check (category in ('unresponsive', 'hostile', 'boundary', 'safety_concern', 'other')),
  note text not null check (char_length(note) between 3 and 1000),
  strike boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete set null
);

create index if not exists behaviour_reports_case_idx on public.behaviour_reports (case_id);
create index if not exists behaviour_reports_subject_idx
  on public.behaviour_reports (subject_account_id) where voided_at is null;

alter table public.behaviour_reports enable row level security;
