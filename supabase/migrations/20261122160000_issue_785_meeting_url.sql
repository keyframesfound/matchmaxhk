-- Issue #785 AC-CONV-1 — a case-level online-lesson link.
--
-- ADDITIVE ONLY: one nullable column on the existing `tutoring_cases` row, plus
-- its format check and column comment. No new table, no grants change, no RLS or
-- policy change — `tutoring_cases` keeps its current posture exactly as it is
-- (RLS enabled; `cases_admin_all` for staff/admin/super_admin, `cases_owner_select`
-- for `parent_id = auth.uid()`; all other reads/writes stay service-role mediated).
--
-- Model
--   meeting_url  the video-call link for this case's online lessons, e.g.
--                "https://zoom.us/j/123456789". The tutor or the desk sets it;
--                both case parties open or copy it from the Case Workspace.
--                NULL = no online link recorded for this case.
--
-- Lookup
--   "Is there an online lesson link for this case?" is a read of one nullable
--   column on a row the caller already reaches through the existing case-scoped
--   access path. No new surface, and never public: the column inherits the
--   table's RLS, so it is only ever visible to the case parties and Ops.
--
-- Format
--   https only, 12-500 chars. The scheme is pinned to `https://` because the
--   link is handed to a browser on the strength of the row alone — a plain
--   `http://` or a `javascript:` value has no business being there. The 12-char
--   floor rejects a bare `https://` or a one-letter host, and the 500-char
--   ceiling keeps a hostile paste from bloating the row.
--
-- Backfill
--   None needed: the column is nullable and every existing case correctly has
--   no online link recorded.

-- ---------------------------------------------------------------------------
-- Column (guard-first, so a re-apply is a no-op)
-- ---------------------------------------------------------------------------
alter table public.tutoring_cases add column if not exists meeting_url text;

do $$
begin
  -- Added NOT VALID first so the constraint does not need a long-held exclusive
  -- lock over the whole table while it scans, then validated in the same run.
  -- Every existing row has meeting_url = NULL, so the validation passes without
  -- touching a single row.
  if not exists (
    select 1 from pg_constraint
    where conname = 'tutoring_cases_meeting_url_check'
  ) then
    alter table public.tutoring_cases
      add constraint tutoring_cases_meeting_url_check
      check (
        meeting_url is null
        or (
          meeting_url ~ '^https://'
          and char_length(meeting_url) between 12 and 500
        )
      ) not valid;
  end if;

  -- Re-runs after an interrupted apply land here: validate only if still pending.
  if exists (
    select 1 from pg_constraint
    where conname = 'tutoring_cases_meeting_url_check'
      and conrelid = 'public.tutoring_cases'::regclass
      and not convalidated
  ) then
    alter table public.tutoring_cases
      validate constraint tutoring_cases_meeting_url_check;
  end if;
end $$;

comment on column public.tutoring_cases.meeting_url is
  '#785 AC-CONV-1: online lesson link (https only). Tutor or desk sets it; case parties open or copy it. Never public.';
