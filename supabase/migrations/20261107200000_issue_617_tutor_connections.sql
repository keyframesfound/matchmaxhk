-- #617 Tutor Connections (Child A): Airbnb-style tutor co-teaching graph.
-- One edge per unordered tutor pair. Every write goes through the
-- service-role server fns in src/features/connections/connections.functions.ts,
-- which enforce the tier_2_verified gate, the 10-per-24h + 25-open-PENDING
-- outbound caps and the 30-day decline cooldown. RLS lets only the two
-- parties read their own rows; anon gets nothing.

create table if not exists public.tutor_connections (
  id uuid primary key default gen_random_uuid(),
  requester_tutor_id uuid not null references public.tutors(id) on delete cascade,
  recipient_tutor_id uuid not null references public.tutors(id) on delete cascade,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'ACCEPTED', 'DECLINED', 'DISCONNECTED', 'BLOCKED')),
  intent_tag text not null
    check (intent_tag in ('SUBJECT_SPLIT', 'GROUP_COTEACH', 'RELIEF_COVER', 'CURRICULUM_PAIR')),
  -- #617: contact details are NEVER stored. The server fn regex-strips
  -- phone/WhatsApp/Telegram/email patterns before insert (see
  -- connections-pure.ts); the token [[mm_hidden_contact]] renders localized.
  intro_note_sanitized text,
  -- #617: set on DECLINE (now + 30 days); blocks pair re-requests until it
  -- expires. Null on every other status.
  cooldown_until timestamptz,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  -- #617 edge case: self-connect is rejected (API 400; the DB backstops it).
  constraint tutor_connections_no_self check (requester_tutor_id <> recipient_tutor_id)
);

-- Mutual simultaneous requests must land on the SAME row (auto-accept):
-- one unique edge per unordered pair. LEAST/GREATEST canonicalise the pair.
create unique index if not exists tutor_connections_pair_unique
  on public.tutor_connections (
    least(requester_tutor_id, recipient_tutor_id),
    greatest(requester_tutor_id, recipient_tutor_id)
  );

-- Rate-limit count (outbound in the last 24h) + outbound pending lists.
create index if not exists tutor_connections_requester_created_idx
  on public.tutor_connections (requester_tutor_id, created_at desc);
-- Inbound pending lists.
create index if not exists tutor_connections_recipient_idx
  on public.tutor_connections (recipient_tutor_id);

revoke all on public.tutor_connections from anon, authenticated;
grant select on public.tutor_connections to authenticated;
grant all on public.tutor_connections to service_role;

alter table public.tutor_connections enable row level security;

-- Parties read their own edges only; all writes are service-role.
create policy tutor_connections_party_select
  on public.tutor_connections
  for select
  to authenticated
  using (
    requester_tutor_id in (select id from public.tutors where user_id = auth.uid())
    or recipient_tutor_id in (select id from public.tutors where user_id = auth.uid())
  );

comment on table public.tutor_connections is
  '#617 tutor co-teaching connection graph. One row per unordered tutor pair; status PENDING|ACCEPTED|DECLINED|DISCONNECTED|BLOCKED. Contact details never stored — intro_note_sanitized is regex-stripped server-side.';
