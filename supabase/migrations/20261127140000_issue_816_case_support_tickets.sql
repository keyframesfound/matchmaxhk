-- ---------------------------------------------------------------------------
-- Issue #816 §2.3 (AC-260-1/2/3) — a support ticket lives ON a case
-- ---------------------------------------------------------------------------
-- A ticket is a case-desk artefact, not a chat product:
--   * one OPEN ticket per case (partial unique index below), so the desk works
--     one conversation at a time and the parent cannot fan out duplicates;
--   * five fixed reasons, and `other` must carry a note (<= 500 chars);
--   * staff replies are free text capped at 500 chars and filtered for contact
--     details in code (src/features/cases/support-tickets.ts), because a ticket
--     must never become a back channel around MatchMax;
--   * a `no_show` ticket is a report, not a fee adjustment. Nothing here (and
--     nothing in the server fns) writes case_fees or any fee table.
--
-- Access model: browser roles get nothing. RLS is enabled with NO policies and
-- the grants below go to service_role only, because every read and write is a
-- service-role server fn that resolves the caller against the case first.
-- ---------------------------------------------------------------------------

create table if not exists public.case_support_tickets (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.tutoring_cases(id) on delete cascade,
  -- Caller-derived, never taken from input.
  opened_by uuid not null references auth.users(id) on delete cascade,
  opened_by_role text not null check (opened_by_role in ('parent', 'tutor', 'centre', 'staff')),
  reason text not null
    check (reason in ('fee_amount', 'no_show', 'cannot_pay', 'wrong_tutor', 'other')),
  note text check (note is null or char_length(note) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'resolved', 'closed')),
  resolved_by uuid references auth.users(id),
  resolution text check (resolution is null or char_length(resolution) between 1 and 500),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- `other` is the only reason that needs the parent to explain themselves.
  constraint other_requires_note check (reason <> 'other' or note is not null)
);

-- AC-260-1: at most one open ticket per case. Resolved/closed rows do not
-- block a later ticket; a concurrent double-open loses on 23505 and the server
-- fn maps that to TICKET_EXISTS.
create unique index if not exists case_support_tickets_one_open
  on public.case_support_tickets (case_id)
  where status = 'open';

create index if not exists idx_case_support_tickets_case
  on public.case_support_tickets (case_id, created_at desc);

comment on table public.case_support_tickets is
  '#816 §2.3: one support ticket per case at a time. Service-role only; no fee columns are touched by a ticket.';
comment on column public.case_support_tickets.opened_by_role is
  '#816: derived from the caller''s relation to the case (partyCase role, or staff for the desk). Never from input.';

-- ---------------------------------------------------------------------------
-- Ticket messages: the parent's original note is on the ticket; every reply
-- after that is a row here. author_id is nullable so deleting an auth user
-- keeps the conversation readable for the desk.
-- ---------------------------------------------------------------------------
create table if not exists public.case_support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.case_support_tickets(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_role text not null check (author_role in ('parent', 'tutor', 'centre', 'staff')),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists idx_case_support_ticket_messages_ticket
  on public.case_support_ticket_messages (ticket_id, created_at);

comment on table public.case_support_ticket_messages is
  '#816 §2.3: replies on a case support ticket. Staff replies are contact-detail filtered in app code. Service-role only.';

-- ---------------------------------------------------------------------------
-- Grants + RLS. Same shape as the #794 progress tables: revoke from the
-- browser roles, grant to service_role, enable RLS with no policies.
-- ---------------------------------------------------------------------------
revoke all on public.case_support_tickets from anon, authenticated;
revoke all on public.case_support_ticket_messages from anon, authenticated;
grant all on public.case_support_tickets to service_role;
grant all on public.case_support_ticket_messages to service_role;

alter table public.case_support_tickets enable row level security;
alter table public.case_support_ticket_messages enable row level security;
