-- Email resend-loop guard (customer report 2026-11-27: repeated
-- "Your MatchMax order is delivered" emails).
--
-- Root cause: deliverOne sent the email BEFORE writing the delivery status, so
-- a worker that died mid-drain (Cloudflare subrequest/CPU limits) left the row
-- pending — and every later drain re-sent it. The event row also stayed
-- pending because the final event update never ran.
--
-- The code now claims a delivery (status 'sending' + claimed_at) before the
-- send and only sends when the claim succeeds; a stale claim (older than the
-- claim window) may be retaken. This column records the claim time.
alter table public.event_deliveries
  add column if not exists claimed_at timestamptz;

comment on column public.event_deliveries.claimed_at is
  'Claim-before-send guard: last time a drain took ownership of this delivery. A claim older than the claim window (10 min) may be retaken; a fresh claim is never re-sent.';
