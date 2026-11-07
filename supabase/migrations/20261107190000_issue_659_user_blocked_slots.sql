-- #659 User-Blocked for parents: weekly unavailable slots kept in Case Manager.
-- These are weekday + band units, the same granularity as case schedule_slots,
-- not lessons or a second calendar. RLS-deny; access only through service-role
-- server fns scoped to the caller.
create table if not exists public.user_blocked_slots (
  user_id uuid not null references auth.users(id) on delete cascade,
  day text not null check (day in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')),
  period text not null check (period in ('morning', 'afternoon', 'evening')),
  created_at timestamptz not null default now(),
  primary key (user_id, day, period)
);

revoke all on public.user_blocked_slots from anon, authenticated;
grant select, insert, delete on public.user_blocked_slots to service_role;
alter table public.user_blocked_slots enable row level security;

comment on table public.user_blocked_slots is
  '#659 a parent''s weekly unavailable slots. Soft: they shape search defaults and clash reminders, never block a request.';
