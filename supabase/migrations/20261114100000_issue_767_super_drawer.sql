-- Issue #767 Super-Drawer (was #746, packs #743): the ONE tutor post-lesson
-- write surface. ADDITIVE ONLY: two new tables, RLS policies, indexes. Nothing
-- existing is altered and no SECURITY DEFINER RPCs are added (every access
-- goes through the app's service-role server fns).
--
-- Model:
--   case_lesson_logs      one row per drawer-logged verified lesson — the
--                         payload half: context-aware topic chips (+ mastery
--                         enum weak|practicing|mastered), the PRIVATE
--                         three-row pulse (Punctuality/Focus/Prep-HW, tutor
--                         eyes only — never dumped raw to parents), the ONE
--                         dictation recap string (CEO lock 2026-11-13) and
--                         recap_status incomplete|complete (the [ Add Recap &
--                         Tags ] dashboard badge reads 'incomplete').
--   case_lesson_fanouts   silent fan-out queue with zero extra tutor clicks:
--                         on Full Sync with >=1 #tag the heatmap cell update
--                         (#740) and notes-recommendation refresh (#744) are
--                         enqueued here; every log enqueues the minimal
--                         weekly-digest signal (#742). Consumers are later
--                         work — this ticket owns the write-side contract.
--
-- The VERIFIED LESSON half is deliberately NOT a new table: the drawer writes
-- the existing case_lessons calendar row (status 'done', client_request_id
-- idempotency from #461), so the #459 verified-hours ledger trigger and the
-- #760 fee-milestone sync (syncCaseFeeMilestones(..., 'case_lesson')) consume
-- it unchanged — no fee fork, no second hours ledger, no double-counting.

-- ---------------------------------------------------------------------------
-- Logs (one per verified lesson)
-- ---------------------------------------------------------------------------
create table if not exists public.case_lesson_logs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.tutoring_cases (id) on delete cascade,
  -- The verified case_lessons row this log completes; unique = one log per
  -- lesson, so the completion pass (badge -> drawer) UPDATEs this row.
  lesson_id uuid not null unique references public.case_lessons (id) on delete cascade,
  logged_by uuid not null references auth.users (id) on delete cascade,
  -- Hours-Only always lands 'incomplete' (the badge); Full Sync with >=1
  -- #tag lands 'complete' (recap stays optional).
  recap_status text not null default 'incomplete'
    check (recap_status in ('incomplete', 'complete')),
  -- [{ "tag": "MarketStructure", "mastery": "weak" | "practicing" | "mastered" | null }]
  topics jsonb not null default '[]'::jsonb check (jsonb_typeof(topics) = 'array'),
  -- Private tutor-only pulse:
  -- { "punctuality": "on_time"|"late", "focus": "attentive"|"good"|"distracted",
  --   "prep_hw": "prepared"|"partial"|"none" }
  pulse jsonb not null default '{}'::jsonb check (jsonb_typeof(pulse) = 'object'),
  -- V1 dictation transcript as ONE string (no parsing this ticket).
  recap text check (recap is null or char_length(recap) between 1 and 2000),
  -- Optional +7d-same-time default from the UI; stored for the #735
  -- Case Workspace "upcoming topic/next lesson" contract.
  next_lesson_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_case_lesson_logs_case
  on public.case_lesson_logs (case_id, created_at desc);
create index if not exists idx_case_lesson_logs_pending
  on public.case_lesson_logs (case_id) where recap_status = 'incomplete';

-- ---------------------------------------------------------------------------
-- Fan-out queue (table rows, not UI; unique per (lesson, job) so a retry or
-- the completion pass never double-enqueues)
-- ---------------------------------------------------------------------------
create table if not exists public.case_lesson_fanouts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.tutoring_cases (id) on delete cascade,
  lesson_id uuid not null references public.case_lessons (id) on delete cascade,
  job text not null check (job in ('heatmap_cell', 'notes_recommendations', 'weekly_digest')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (lesson_id, job)
);

create index if not exists idx_case_lesson_fanouts_pending
  on public.case_lesson_fanouts (created_at) where status = 'pending';

-- ---------------------------------------------------------------------------
-- updated_at touch trigger (optimistic-concurrency version, #613 pattern)
-- ---------------------------------------------------------------------------
create or replace function public.super_drawer_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_case_lesson_logs_touch on public.case_lesson_logs;
create trigger trg_case_lesson_logs_touch before update on public.case_lesson_logs
  for each row execute function public.super_drawer_touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS (the live pg_default_acl grants anon+authenticated full privileges on
-- every new table — enable RLS deny-by-default and add explicit owner
-- policies so the default grant is neutralized; service_role keeps full
-- access and the server fns run on it).
-- ---------------------------------------------------------------------------
revoke all on public.case_lesson_logs from anon, authenticated;
revoke all on public.case_lesson_fanouts from anon, authenticated;
grant select, insert, update on public.case_lesson_logs to service_role;
grant select, insert, update on public.case_lesson_fanouts to service_role;

alter table public.case_lesson_logs enable row level security;
alter table public.case_lesson_fanouts enable row level security;

-- Owner rows: the assigned tutor of the case (auth uid -> tutors.user_id).
-- No delete policy (logs/fan-outs are never deleted), nothing for anon.
create policy case_lesson_logs_tutor_select on public.case_lesson_logs
  for select using (
    exists (
      select 1
      from public.tutoring_cases c
      join public.tutors t on t.id = c.matched_tutor_id
      where c.id = case_lesson_logs.case_id
        and t.user_id = auth.uid()
    )
  );
create policy case_lesson_logs_tutor_insert on public.case_lesson_logs
  for insert with check (
    exists (
      select 1
      from public.tutoring_cases c
      join public.tutors t on t.id = c.matched_tutor_id
      where c.id = case_lesson_logs.case_id
        and t.user_id = auth.uid()
    )
  );
create policy case_lesson_logs_tutor_update on public.case_lesson_logs
  for update using (
    exists (
      select 1
      from public.tutoring_cases c
      join public.tutors t on t.id = c.matched_tutor_id
      where c.id = case_lesson_logs.case_id
        and t.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1
      from public.tutoring_cases c
      join public.tutors t on t.id = c.matched_tutor_id
      where c.id = case_lesson_logs.case_id
        and t.user_id = auth.uid()
    )
  );

create policy case_lesson_fanouts_tutor_select on public.case_lesson_fanouts
  for select using (
    exists (
      select 1
      from public.tutoring_cases c
      join public.tutors t on t.id = c.matched_tutor_id
      where c.id = case_lesson_fanouts.case_id
        and t.user_id = auth.uid()
    )
  );
create policy case_lesson_fanouts_tutor_insert on public.case_lesson_fanouts
  for insert with check (
    exists (
      select 1
      from public.tutoring_cases c
      join public.tutors t on t.id = c.matched_tutor_id
      where c.id = case_lesson_fanouts.case_id
        and t.user_id = auth.uid()
    )
  );
create policy case_lesson_fanouts_tutor_update on public.case_lesson_fanouts
  for update using (
    exists (
      select 1
      from public.tutoring_cases c
      join public.tutors t on t.id = c.matched_tutor_id
      where c.id = case_lesson_fanouts.case_id
        and t.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1
      from public.tutoring_cases c
      join public.tutors t on t.id = c.matched_tutor_id
      where c.id = case_lesson_fanouts.case_id
        and t.user_id = auth.uid()
    )
  );

comment on table public.case_lesson_logs is
  '#767 Super-Drawer log: topics+mastery, PRIVATE tutor pulse, one recap string, recap_status badge state. One row per verified case_lessons row.';
comment on table public.case_lesson_fanouts is
  '#767 silent fan-out queue: heatmap_cell (#740) + notes_recommendations (#744) on Full Sync with >=1 tag, weekly_digest (#742) signal on every log. Consumers are later work.';
