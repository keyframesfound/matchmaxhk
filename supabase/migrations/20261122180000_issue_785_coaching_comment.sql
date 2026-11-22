-- Issue #785 AC-735-2b — a post-lesson coaching comment the parties can read.
--
-- ADDITIVE ONLY: three nullable columns on the existing `case_lessons` row, one
-- length check, one FK to auth.users, and column comments. No new table, no
-- grants change, no policy change — `case_lessons` keeps its existing posture
-- exactly as it is (RLS enabled, no anon/authenticated table grants; reads go
-- through the existing case-scoped server path).
--
-- Model
--   coaching_comment     what the tutor says to the parties after the lesson is
--                        done. 1-1500 chars; NULL = no comment left. This is the
--                        party-visible field.
--   coaching_comment_by  who wrote the comment. ON DELETE SET NULL so a deleted
--                        staff account never takes the comment with it.
--   coaching_comment_at  when it was written (also used to order/staleness-check
--                        against later lesson edits).
--   All three are set together by the writer; no partial states are enforced by
--   the database because the authoring path is a single update.
--
-- Separation of concerns (the reason this is a new column, not a reuse)
--   `private_note` is tutor-private (#204) and must never be surfaced to the
--   parent/student — this migration deliberately does not touch it.
--   The Super-Drawer log (#767) is its own append-only surface; a coaching
--   comment is one current statement about one lesson, not a log entry, so it
--   does not live there either. Three separate fields, three separate audiences.
--
-- Visibility
--   Party-visible in the Case Workspace, never public: no grants are added for
--   anon or authenticated, so nothing here widens the readable surface.
--
-- Backfill
--   None needed: all three columns are nullable and every existing row is
--   correctly "no coaching comment yet".

-- ---------------------------------------------------------------------------
-- Columns (guard-first, so a re-apply is a no-op)
-- ---------------------------------------------------------------------------
alter table public.case_lessons add column if not exists coaching_comment text;
alter table public.case_lessons add column if not exists coaching_comment_by uuid;
alter table public.case_lessons add column if not exists coaching_comment_at timestamptz;

do $$
begin
  -- coaching_comment: NULL, or 1-1500 chars. An empty string is rejected by the
  -- lower bound (`''` has length 0), so "no comment" must be NULL rather than a
  -- blank that renders as an empty bubble.
  if not exists (
    select 1 from pg_constraint where conname = 'case_lessons_coaching_comment_check'
  ) then
    alter table public.case_lessons
      add constraint case_lessons_coaching_comment_check
      check (
        coaching_comment is null
        or char_length(coaching_comment) between 1 and 1500
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'case_lessons_coaching_comment_by_fkey'
  ) then
    alter table public.case_lessons
      add constraint case_lessons_coaching_comment_by_fkey
      foreign key (coaching_comment_by) references auth.users (id)
      on delete set null;
  end if;
end $$;

comment on column public.case_lessons.coaching_comment is
  '#785 AC-735-2: post-lesson coaching comment — party-visible, independent of the #767 Super-Drawer log; separate from the tutor-private private_note.';
comment on column public.case_lessons.coaching_comment_by is
  '#785 AC-735-2: post-lesson coaching comment — party-visible, independent of the #767 Super-Drawer log; separate from the tutor-private private_note.';
comment on column public.case_lessons.coaching_comment_at is
  '#785 AC-735-2: post-lesson coaching comment — party-visible, independent of the #767 Super-Drawer log; separate from the tutor-private private_note.';
