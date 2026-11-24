-- #737 §3 MUST: a BYOS invite expires 7 days after it is created.
--
-- The token is a 32-byte secret shared over WhatsApp, so the window is the only
-- thing limiting the blast radius of a leaked link. Until now an invite stayed
-- claimable forever, meaning an old link still granted the HK$0 MatchMax admin
-- fee on a brand-new case.
--
-- Existing rows are backfilled from created_at (not from now()), so a tutor's
-- live invite does not jump straight to "expired" on deploy.

alter table public.byos_invites
  add column if not exists expires_at timestamptz;

update public.byos_invites
   set expires_at = created_at + interval '7 days'
 where expires_at is null;

alter table public.byos_invites
  alter column expires_at set default (now() + interval '7 days');

alter table public.byos_invites
  alter column expires_at set not null;

comment on column public.byos_invites.expires_at is
  '#737: created_at + 7 days. A claim after this instant is refused as expired.';
