-- Issue #451: desk language flag on cases (EN / 繁中 / 简体) so WA macros
-- insert the right language block first. Default zh-HK per the issue.
-- Applied to prod via MCP on 2026-10-25; this file mirrors it for the repo.

ALTER TABLE public.tutoring_cases
  ADD COLUMN IF NOT EXISTS desk_language text NOT NULL DEFAULT 'zh-HK';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tutoring_cases_desk_language_check'
  ) THEN
    ALTER TABLE public.tutoring_cases
      ADD CONSTRAINT tutoring_cases_desk_language_check
      CHECK (desk_language IN ('en', 'zh-HK', 'zh-CN'));
  END IF;
END $$;
