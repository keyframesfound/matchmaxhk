-- #725 slice 2: account-synced saved searches + new-match alerts.
create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('tutors', 'cases', 'notes')),
  params jsonb not null default '{}'::jsonb,
  label text not null check (char_length(label) between 1 and 80),
  alerts_enabled boolean not null default true,
  -- Matcher watermark: only listings published after this alert.
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint saved_searches_params_object check (jsonb_typeof(params) = 'object'),
  constraint saved_searches_unique unique (account_id, scope, params)
);

create index if not exists saved_searches_alert_scan_idx
  on public.saved_searches (last_checked_at)
  where alerts_enabled;

alter table public.saved_searches enable row level security;

drop policy if exists saved_searches_owner_select on public.saved_searches;
create policy saved_searches_owner_select on public.saved_searches
  for select to authenticated using (account_id = auth.uid());
drop policy if exists saved_searches_owner_insert on public.saved_searches;
create policy saved_searches_owner_insert on public.saved_searches
  for insert to authenticated with check (account_id = auth.uid());
drop policy if exists saved_searches_owner_update on public.saved_searches;
create policy saved_searches_owner_update on public.saved_searches
  for update to authenticated using (account_id = auth.uid()) with check (account_id = auth.uid());
drop policy if exists saved_searches_owner_delete on public.saved_searches;
create policy saved_searches_owner_delete on public.saved_searches
  for delete to authenticated using (account_id = auth.uid());

-- Dedupe: at most one alert per (saved search, listing). Service role only.
create table if not exists public.saved_search_matches (
  saved_search_id uuid not null references public.saved_searches(id) on delete cascade,
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (saved_search_id, entity_id)
);
alter table public.saved_search_matches enable row level security;
revoke all on public.saved_search_matches from anon, authenticated;

grant select, insert, update, delete on public.saved_searches to authenticated;
revoke all on public.saved_searches from anon;
