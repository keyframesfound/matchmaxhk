-- #613 Course/Case Roster + 1-Tap Attendance + Parent Claim Magic Link.
-- ADDITIVE ONLY: new enums, new tables, RLS policies and indexes. Nothing
-- existing is altered. No SECURITY DEFINER RPCs (every access goes through
-- the app's service-role server fns), so no EXECUTE grants to police.
--
-- Model:
--   rosters               one roster per course / matched case / private class
--   roster_students       enrolled students; LINKED when a parent account is
--                         matched, PENDING_LINK until the claim token is used
--   roster_markers        centre-affiliated tutors authorized to take
--                         attendance (revoke = set revoked_at, history kept)
--   roster_sessions       one check-in per (roster, session_key) — the client
--                         key makes a double-tap Save idempotent
--   roster_attendance     one row per (session, student); present/late
--                         increment the student's completed-lesson counter
--                         (handled by the server fns, not triggers, so the
--                         #615 fee-milestone sibling can read the same state)
--   roster_attendance_audit  edit/void audit trail inside the 24h window
--   roster_claim_tokens   /claim-roster/{token} magic links, stored hashed,
--                         single-use, 14-day expiry, service-role only
--
-- Cap.57: tutors and centres are independent operators; parent accounts are
-- free (HK$0) — the roster never stores any fee for parents.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.roster_source_type as enum
  ('partner_course', 'matched_case', 'private_class');
create type public.roster_link_status as enum ('linked', 'pending_link');
create type public.roster_student_source as enum ('matchmax_matched', 'self_brought');
create type public.roster_engagement_type as enum ('standard_ongoing', 'short_course');
create type public.roster_attendance_status as enum
  ('present', 'late', 'absent_excused', 'absent_unexcused');
create type public.roster_session_status as enum ('scheduled', 'completed', 'voided');

-- ---------------------------------------------------------------------------
-- Rosters
-- ---------------------------------------------------------------------------
create table public.rosters (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  course_id uuid references public.courses (id) on delete set null,
  case_id uuid references public.tutoring_cases (id) on delete set null,
  case_code text,
  source_type public.roster_source_type not null default 'private_class',
  title text not null check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rosters_owner_idx on public.rosters (owner_user_id, created_at desc);
create index rosters_organization_idx on public.rosters (organization_id)
  where organization_id is not null;
create index rosters_course_idx on public.rosters (course_id) where course_id is not null;

-- ---------------------------------------------------------------------------
-- Roster students
-- ---------------------------------------------------------------------------
create table public.roster_students (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references public.rosters (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  -- #613 duplicate rule: same student name + same parent contact in the same
  -- roster is blocked idempotently by this pair (unique index below).
  display_name_normalized text not null,
  parent_contact text not null check (char_length(parent_contact) between 5 and 254),
  parent_contact_normalized text not null,
  link_status public.roster_link_status not null default 'pending_link',
  linked_account_id uuid references auth.users (id) on delete set null,
  -- MATCHMAX_MATCHED vs SELF_BROUGHT separation is decided by the roster's
  -- source_type in the server fn; stored per student so it survives a roster
  -- being reused across sources.
  source_tag public.roster_student_source not null default 'self_brought',
  engagement_type public.roster_engagement_type not null default 'standard_ongoing',
  package_lesson_count integer check (package_lesson_count in (4, 8, 10)),
  completed_lesson_count integer not null default 0 check (completed_lesson_count >= 0),
  -- #613 enquiry convert: preserved source attribution (enquiry reference as
  -- supplied by the converting surface). Never a contact field.
  converted_enquiry_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Active duplicate block: one live record per (roster, contact, name).
create unique index roster_students_active_uq
  on public.roster_students (roster_id, parent_contact_normalized, display_name_normalized);

create index roster_students_roster_idx on public.roster_students (roster_id, created_at);
create index roster_students_linked_account_idx on public.roster_students (linked_account_id)
  where linked_account_id is not null;

-- ---------------------------------------------------------------------------
-- Roster markers (centre-affiliated tutors authorized to mark attendance).
-- Affiliation source: centre_affiliations (role_type='affiliated_tutor',
-- status='approved') from #548; markers are keyed by the tutor's ACCOUNT.
-- ---------------------------------------------------------------------------
create table public.roster_markers (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references public.rosters (id) on delete cascade,
  marker_user_id uuid not null references auth.users (id) on delete cascade,
  assigned_by_user_id uuid not null references auth.users (id) on delete cascade,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- One marker row per (roster, tutor account); revoke reuses the row
-- (revoked_at set), re-assign clears it, so the assignment history stays
-- single-row.
create unique index roster_markers_roster_marker_uq
  on public.roster_markers (roster_id, marker_user_id);
create index roster_markers_marker_idx on public.roster_markers (marker_user_id)
  where revoked_at is null;

-- ---------------------------------------------------------------------------
-- Sessions (one check-in batch)
-- ---------------------------------------------------------------------------
create table public.roster_sessions (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references public.rosters (id) on delete cascade,
  -- Client-generated idempotency key: a double-tap Save lands twice but
  -- inserts ONE session (unique index below).
  session_key text not null check (char_length(session_key) between 8 and 64),
  -- HKT wall clock of the class; audit timestamps are timestamptz (UTC).
  session_date date not null,
  start_time time not null,
  session_note varchar(200),
  marker_user_id uuid not null references auth.users (id) on delete cascade,
  status public.roster_session_status not null default 'completed',
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- #613 idempotency: one session per (roster, key).
create unique index roster_sessions_roster_key_uq
  on public.roster_sessions (roster_id, session_key);
create index roster_sessions_roster_idx on public.roster_sessions (roster_id, session_date desc);

-- ---------------------------------------------------------------------------
-- Attendance rows
-- ---------------------------------------------------------------------------
create table public.roster_attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.roster_sessions (id) on delete cascade,
  roster_id uuid not null references public.rosters (id) on delete cascade,
  roster_student_id uuid not null references public.roster_students (id) on delete cascade,
  status public.roster_attendance_status not null,
  marked_by_user_id uuid not null references auth.users (id) on delete cascade,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index roster_attendance_session_student_uq
  on public.roster_attendance (session_id, roster_student_id);
create index roster_attendance_student_idx on public.roster_attendance
  (roster_student_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Audit trail (edits + voids inside the 24h correction window)
-- ---------------------------------------------------------------------------
create table public.roster_attendance_audit (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.roster_attendance (id) on delete cascade,
  session_id uuid not null references public.roster_sessions (id) on delete cascade,
  actor_user_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (action in ('edit', 'void')),
  from_status public.roster_attendance_status,
  to_status public.roster_attendance_status,
  created_at timestamptz not null default now()
);

create index roster_attendance_audit_attendance_idx
  on public.roster_attendance_audit (attendance_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Claim tokens (hashed, single-use, 14-day expiry) — service-role only
-- ---------------------------------------------------------------------------
create table public.roster_claim_tokens (
  id uuid primary key default gen_random_uuid(),
  roster_student_id uuid not null references public.roster_students (id) on delete cascade,
  created_by_user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_user_id uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index roster_claim_tokens_student_idx
  on public.roster_claim_tokens (roster_student_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at touch trigger (optimistic-concurrency version)
-- ---------------------------------------------------------------------------
create or replace function public.roster_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_rosters_touch on public.rosters;
create trigger trg_rosters_touch before update on public.rosters
  for each row execute function public.roster_touch_updated_at();

drop trigger if exists trg_roster_students_touch on public.roster_students;
create trigger trg_roster_students_touch before update on public.roster_students
  for each row execute function public.roster_touch_updated_at();

drop trigger if exists trg_roster_sessions_touch on public.roster_sessions;
create trigger trg_roster_sessions_touch before update on public.roster_sessions
  for each row execute function public.roster_touch_updated_at();

drop trigger if exists trg_roster_attendance_touch on public.roster_attendance;
create trigger trg_roster_attendance_touch before update on public.roster_attendance
  for each row execute function public.roster_touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS (defense in depth: the app reads/writes via service-role server fns,
-- but the tables must never be anon-writable).
-- ---------------------------------------------------------------------------
alter table public.rosters enable row level security;
alter table public.roster_students enable row level security;
alter table public.roster_markers enable row level security;
alter table public.roster_sessions enable row level security;
alter table public.roster_attendance enable row level security;
alter table public.roster_attendance_audit enable row level security;
alter table public.roster_claim_tokens enable row level security;

-- Rosters: owner full access; an active assigned marker can read.
create policy rosters_owner_all on public.rosters
  for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);
create policy rosters_marker_select on public.rosters
  for select using (
    exists (
      select 1 from public.roster_markers m
      where m.roster_id = rosters.id
        and m.revoked_at is null
        and m.marker_user_id = auth.uid()
    )
  );

-- Students: readable by owner + active markers; writable by the owner only
-- (markers take attendance, they do not edit the roster).
create policy roster_students_owner_all on public.roster_students
  for all using (
    exists (select 1 from public.rosters r where r.id = roster_id and r.owner_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.rosters r where r.id = roster_id and r.owner_user_id = auth.uid())
  );
create policy roster_students_marker_select on public.roster_students
  for select using (
    exists (
      select 1 from public.rosters r
      join public.roster_markers m on m.roster_id = r.id
      where r.id = roster_id and m.revoked_at is null and m.marker_user_id = auth.uid()
    )
  );

-- Markers: managed by the roster owner; a tutor reads their own assignments.
create policy roster_markers_owner_all on public.roster_markers
  for all using (
    exists (select 1 from public.rosters r where r.id = roster_id and r.owner_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.rosters r where r.id = roster_id and r.owner_user_id = auth.uid())
  );
create policy roster_markers_tutor_select on public.roster_markers
  for select using (marker_user_id = auth.uid());

-- Sessions + attendance: owner and active markers can insert/select; updates
-- (edits/voids) go through the server fns, allowed for both via RLS too.
create policy roster_sessions_owner_all on public.roster_sessions
  for all using (
    exists (select 1 from public.rosters r where r.id = roster_id and r.owner_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.rosters r where r.id = roster_id and r.owner_user_id = auth.uid())
  );
create policy roster_sessions_marker_all on public.roster_sessions
  for all using (
    exists (
      select 1 from public.rosters r
      join public.roster_markers m on m.roster_id = r.id
      where r.id = roster_id and m.revoked_at is null and m.marker_user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.rosters r
      join public.roster_markers m on m.roster_id = r.id
      where r.id = roster_id and m.revoked_at is null and m.marker_user_id = auth.uid()
    )
  );

create policy roster_attendance_owner_all on public.roster_attendance
  for all using (
    exists (select 1 from public.rosters r where r.id = roster_id and r.owner_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.rosters r where r.id = roster_id and r.owner_user_id = auth.uid())
  );
create policy roster_attendance_marker_all on public.roster_attendance
  for all using (
    exists (
      select 1 from public.rosters r
      join public.roster_markers m on m.roster_id = r.id
      where r.id = roster_id and m.revoked_at is null and m.marker_user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.rosters r
      join public.roster_markers m on m.roster_id = r.id
      where r.id = roster_id and m.revoked_at is null and m.marker_user_id = auth.uid()
    )
  );

-- Audit: written by the server fns (service role); owner can read the trail.
-- The audit table has NO roster_id column — reach it through the attendance
-- row (merge-day fix; the as-shipped policy failed to compile with 42703).
create policy roster_attendance_audit_owner_select on public.roster_attendance_audit
  for select using (
    exists (
      select 1
      from public.roster_attendance ra
      join public.rosters r on r.id = ra.roster_id
      where ra.id = roster_attendance_audit.attendance_id
        and r.owner_user_id = auth.uid()
    )
  );

-- Claim tokens: NO policies — service-role only (the child_claim_tokens
-- pattern). Nothing below grants anon/authenticated any access.

comment on table public.rosters is
  '#613 course/case/private-class roster owned by an educator (tutor or centre member).';
comment on table public.roster_students is
  '#613 enrolled students; link_status tracks the parent claim (linked/pending_link).';
comment on table public.roster_markers is
  '#613 affiliated tutor accounts authorized to mark attendance; revoke sets revoked_at, history kept.';
comment on table public.roster_sessions is
  '#613 one check-in batch; (roster_id, session_key) unique makes double-tap save idempotent.';
comment on table public.roster_attendance is
  '#613 per-student attendance; present/late increment completed_lesson_count (server fns).';
comment on table public.roster_attendance_audit is
  '#613 edit/void audit trail inside the 24h correction window.';
comment on table public.roster_claim_tokens is
  '#613 /claim-roster tokens, SHA-256 hashed at rest, single-use, 14-day expiry, service-role only.';
