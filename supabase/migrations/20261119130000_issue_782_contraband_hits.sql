-- #782 §2.3 (was #755): staff-visible log of blocked saves. Stores only the
-- category, the matched term (<= 60 chars) and where it happened; never the
-- blocked file or full text. RLS on, no policies: service role only.

create table if not exists public.contraband_hits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  surface text not null,
  category text not null,
  matched_term text,
  created_at timestamptz not null default now()
);

create index if not exists contraband_hits_created_idx
  on public.contraband_hits (created_at desc);

alter table public.contraband_hits enable row level security;
