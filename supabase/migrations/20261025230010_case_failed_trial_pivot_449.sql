-- Issue #449: board status for a failed L1 match entering the instant
-- rematch pivot. Display/board axis only; fee math (1.0x L1 on the failed
-- case, standard 1.5 on the rematch case) is unchanged.
-- Applied to prod via MCP on 2026-10-25; this file mirrors it for the repo.

ALTER TYPE public.case_request_status
  ADD VALUE IF NOT EXISTS 'failed_trial_pivot' BEFORE 'closed';
