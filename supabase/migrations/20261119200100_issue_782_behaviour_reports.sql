-- Issue #782 §2.5 (was #703) — PRIVATE pre-lesson behaviour reports + concierge
-- strikes (concierge / matching ops only).
--
-- Scope lock: an INTERNAL trust / ops tool. It MUST NOT publish on the tutor
-- card or the parent profile, and it is NOT a replacement for the §2.4 Urgent
-- Safety quarantine (parallel PR). No automatic consequences are implemented
-- here (AC-703-3 [UNVERIFIED]): filing a report or a strike only RECORDS it —
-- no auto-quarantine, no auto-block of rematches/shortlists. Thresholds for
-- any rematch / shortlist eligibility consequence await Ryan's decision and
-- must be reconciled with #772 (one-active-trial) and #760 before building.
--
-- Shape choices:
--   * behaviour_reports — one row per ops-filed concern, tied to a
--     tutoring_cases row (the case IS the introduction surface; no separate
--     introduction table exists). The subject is recorded on the report
--     itself: subject_party picks the party, and exactly one of
--     subject_parent_id / subject_tutor_id is captured AT REPORT TIME so a
--     strike survives later case rematches (the case's parent_id /
--     matched_tutor_id can move).
--   * concierge_strikes — a small LEDGER (one row per strike) instead of a
--     maintained counter: there is no per-subject table to hang a count on,
--     and a ledger lets ops see both the count and where each strike came
--     from, and lets a future rules change (e.g. severity weighting, staff
--     retraction) add or remove single rows without rewriting totals.
--     Today the server fn inserts exactly ONE strike per report.
--
-- INTERNAL ONLY (same pattern as case_fee_milestones, migration
-- 20261112100000): deny-by-default. No anon/authenticated grants at all —
-- staff reads/writes go through admin-gated server fns on the service-role
-- client. RLS enabled on top of the empty grant set so the pg_default_acl
-- pattern cannot re-open it.

create table if not exists public.behaviour_reports (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.tutoring_cases (id) on delete cascade,
  subject_party text not null check (subject_party in ('parent', 'tutor')),
  -- Exactly one of the two subject columns is set (server fn enforces; no DB
  -- check so an auth.users deletion cannot wedge on a constraint).
  subject_parent_id uuid,
  subject_tutor_id uuid references public.tutors (id) on delete restrict,
  concern text not null check (char_length(concern) between 1 and 2000),
  severity text not null default 'low' check (severity in ('low', 'medium', 'high')),
  reported_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists behaviour_reports_case_idx
  on public.behaviour_reports (case_id);
create index if not exists behaviour_reports_subject_idx
  on public.behaviour_reports (subject_parent_id, subject_tutor_id);

create table if not exists public.concierge_strikes (
  id uuid primary key default gen_random_uuid(),
  behaviour_report_id uuid not null references public.behaviour_reports (id) on delete cascade,
  case_id uuid not null references public.tutoring_cases (id) on delete cascade,
  -- Same capture-at-strike-time subject columns as the report.
  subject_parent_id uuid,
  subject_tutor_id uuid references public.tutors (id) on delete restrict,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists concierge_strikes_parent_idx
  on public.concierge_strikes (subject_parent_id);
create index if not exists concierge_strikes_tutor_idx
  on public.concierge_strikes (subject_tutor_id);

alter table public.behaviour_reports enable row level security;
alter table public.concierge_strikes enable row level security;

do $$
begin
  execute format('revoke all on public.behaviour_reports from anon, authenticated');
  execute format('grant select, insert, update, delete on public.behaviour_reports to service_role');
  execute format('revoke all on public.concierge_strikes from anon, authenticated');
  execute format('grant select, insert, update, delete on public.concierge_strikes to service_role');
end $$;

comment on table public.behaviour_reports is
  'Issue #782 §2.5 (was #703): private pre-lesson behaviour reports filed by concierge/matching ops against a case. INTERNAL ONLY — never shown on public tutor cards or parent profiles, never auto-quarantines anything. Service-role only; no anon/authenticated grants or policies.';
comment on column public.behaviour_reports.subject_party is
  'Which party the concern is about: parent or tutor. Exactly one of subject_parent_id / subject_tutor_id is set (captured at report time so it survives rematches).';
comment on table public.concierge_strikes is
  'Issue #782 §2.5 concierge strike LEDGER: one row per strike (today exactly one per behaviour report). Ops count strikes by grouping this table; no automatic rematch/shortlist consequence is implemented (AC-703-3 [UNVERIFIED] — thresholds await Ryan).';
