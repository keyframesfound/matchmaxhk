-- #783 §2.4 (was #737): BYOS one-time invite, 0 admin fee carve-out.
-- Additive only.
--
-- tutoring_cases.case_source / admin_fee_waived: the waiver flags. The
-- authenticated role holds a broad column UPDATE grant on tutoring_cases, so
-- a guard trigger makes these two columns service-role only (a parent or
-- tutor can never self-waive the fee).
--
-- byos_invites: one row per invite. Only the SHA-256 of the token is stored;
-- the raw token lives only in the link the tutor shares. RLS on with no
-- policies = service role only (the server fns).

alter table public.tutoring_cases
  add column if not exists case_source text,
  add column if not exists admin_fee_waived boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tutoring_cases_case_source_check'
  ) then
    alter table public.tutoring_cases
      add constraint tutoring_cases_case_source_check
      check (case_source is null or case_source in ('BYOS_DIRECT'));
  end if;
end $$;

create or replace function public.guard_case_fee_waiver()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.case_source := null;
    new.admin_fee_waived := false;
    return new;
  end if;
  if new.case_source is distinct from old.case_source
     or new.admin_fee_waived is distinct from old.admin_fee_waived then
    raise exception 'case_source / admin_fee_waived are staff-only' using errcode = '42501';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_guard_case_fee_waiver'
      and tgrelid = 'public.tutoring_cases'::regclass
  ) then
    create trigger trg_guard_case_fee_waiver
      before insert or update on public.tutoring_cases
      for each row execute function public.guard_case_fee_waiver();
  end if;
end $$;

create table if not exists public.byos_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  tutor_id uuid not null references public.tutors(id) on delete cascade,
  invitee_label text not null check (char_length(invitee_label) between 1 and 60),
  subject text not null check (char_length(subject) between 1 and 80),
  level text check (level is null or char_length(level) <= 80),
  hourly_rate_hkd numeric not null check (hourly_rate_hkd > 0 and hourly_rate_hkd <= 100000),
  status text not null default 'active' check (status in ('active', 'claimed', 'revoked')),
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_case_id uuid references public.tutoring_cases(id) on delete set null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  revoked_at timestamptz
);

-- One active unused invite per tutor-student pair (V1).
create unique index if not exists byos_invites_one_active_per_pair
  on public.byos_invites (tutor_id, lower(invitee_label))
  where status = 'active';

create index if not exists byos_invites_tutor_idx
  on public.byos_invites (tutor_id, created_at desc);

alter table public.byos_invites enable row level security;

-- The case needs a lesson mode (tutoring_cases.mode is NOT NULL).
alter table public.byos_invites
  add column if not exists lesson_mode text not null default 'online'
    check (lesson_mode in ('online', 'f2f'));
