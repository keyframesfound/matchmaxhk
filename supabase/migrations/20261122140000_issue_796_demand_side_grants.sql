-- Issue #796 §2.7 — defence in depth for `case_demand_side`.
--
-- #637 created this table without revoking the public-schema default grants, so
-- `anon` and `authenticated` still hold SELECT/INSERT/UPDATE/DELETE on it. RLS
-- is enabled with zero policies, which means every browser read returns nothing
-- and every browser write is refused — the table is not exposed today. This
-- migration removes the standing privilege anyway so the only door is the
-- service role, matching `case_topic_flags` / `case_topic_plan` /
-- `case_usefulness_pulses` from this same ticket.
--
-- Safe: every reader and writer of this table runs on the service role
-- (`demand-side.functions.ts`, `case-progress.functions.ts`); no browser code
-- queries it directly, and `pg_policies` is empty.
--
-- Revoke-like this is reversible (`grant ... to authenticated`), but it is not
-- re-run blindly: `revoke` is idempotent, so the file can be applied twice.

revoke all on public.case_demand_side from anon, authenticated;

-- Service role keeps the table outright (it bypasses RLS by design); this is a
-- no-op if the grant already exists.
grant select, insert, update, delete on public.case_demand_side to service_role;

-- Keep RLS on and policy-free: with no browser grant the policies are
-- unreachable, and their absence is what stops a future stray `grant` from
-- silently reopening the table.
alter table public.case_demand_side enable row level security;
