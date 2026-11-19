-- #782 §2.1 (was #755): mandatory one-time Safety, Clean Record & Legal
-- Conduct Declaration. One row per account per attestation version; a new
-- version re-prompts. Additive only. RLS on with no policies: the server fns
-- (service role) write and read it; staff read the audit rows.

create table if not exists public.safety_attestations (
  user_id uuid not null references auth.users(id) on delete cascade,
  attestation_version text not null,
  safety_attestation_accepted_at timestamptz not null default now(),
  attestation_ip_address text,
  user_agent text,
  primary key (user_id, attestation_version)
);

alter table public.safety_attestations enable row level security;
