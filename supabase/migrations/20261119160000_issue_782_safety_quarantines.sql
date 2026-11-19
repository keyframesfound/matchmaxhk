-- #782 §2.4 (was #755): auto-quarantine + staff Emergency Suspend audit.
-- One row per quarantine / suspend action; staff release it. The card lock
-- itself reuses tutors.card_hidden_by_ban (owner cannot republish while set,
-- trg_tutors_owner_enforcement_guard). RLS on, no policies: service role only.

create table if not exists public.safety_quarantines (
  id uuid primary key default gen_random_uuid(),
  trigger_kind text not null
    check (trigger_kind in ('verified_report', 'unmatched_threshold', 'emergency_suspend')),
  tutor_id uuid references public.tutors(id) on delete set null,
  material_id uuid references public.digital_materials(id) on delete set null,
  account_id uuid references auth.users(id) on delete set null,
  report_id uuid references public.reports(id) on delete set null,
  hidden_material_ids uuid[] not null default '{}',
  card_was_published boolean not null default false,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  released_by uuid references auth.users(id) on delete set null
);

create index if not exists safety_quarantines_open_idx
  on public.safety_quarantines (created_at desc) where released_at is null;

alter table public.safety_quarantines enable row level security;
