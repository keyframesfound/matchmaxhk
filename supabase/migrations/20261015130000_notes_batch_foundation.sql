-- #312/#314/#136/#141 batch foundation.
-- Additive only (Workers Builds never applies migrations; applied live via
-- Supabase MCP before the UI lands).

-- #136: approximate word count, tutor-entered, optional, positive.
alter table public.digital_materials
  add column if not exists word_count integer;
alter table public.digital_materials
  drop constraint if exists digital_materials_word_count_check;
alter table public.digital_materials
  add constraint digital_materials_word_count_check
  check (word_count is null or word_count > 0);

-- #314: flashcards join notes/mock/exemplar as a material type.
alter table public.digital_materials
  drop constraint if exists digital_materials_material_type_check;
alter table public.digital_materials
  add constraint digital_materials_material_type_check
  check (material_type in ('notes', 'mock', 'exemplar', 'flashcards'));

-- #350 (one-shot legacy subject audit, 2026-10-15): the marketplace held
-- exactly one listing at audit time (subject_tag = 'Physics', published),
-- which is inside the #348 allowlist. ZERO junk rows existed, so no data
-- UPDATE is needed — the subject allowlist on every save path (since #348)
-- plus this audit closes the issue. Do not re-add a SQL-side allowlist
-- duplicate of getSubjectOptionsForCategory; it would drift.

-- #141: per-account post-signup checklist state (both tutors and parents).
create table if not exists public.account_checklist (
  account_id uuid primary key references auth.users (id) on delete cascade,
  completed_steps text[] not null default '{}',
  dismissed_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.account_checklist enable row level security;
drop policy if exists "account_checklist owner select" on public.account_checklist;
create policy "account_checklist owner select"
  on public.account_checklist for select
  using (account_id = auth.uid());
drop policy if exists "account_checklist owner insert" on public.account_checklist;
create policy "account_checklist owner insert"
  on public.account_checklist for insert
  with check (account_id = auth.uid());
drop policy if exists "account_checklist owner update" on public.account_checklist;
create policy "account_checklist owner update"
  on public.account_checklist for update
  using (account_id = auth.uid())
  with check (account_id = auth.uid());
