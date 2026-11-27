-- #825: desk-queued backup rows share the wave ledger with the engine's
-- ranked queue, but the desk sends them by hand (#797). source = 'cs_backup'
-- marks a row the automated wave drain must never notify; engine rows keep the
-- existing behaviour. Existing rows backfill to 'engine' via the default.
ALTER TABLE public.case_match_queue
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'engine'
  CHECK (source IN ('engine', 'cs_backup'));

COMMENT ON COLUMN public.case_match_queue.source IS
  'engine = ranked by the wave engine and auto-notified; cs_backup = desk-queued (#825) and never auto-notified.';
