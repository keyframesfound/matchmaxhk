-- Issue #785 AC-CONV-4 — a file or link attached to a lesson's post-lesson
-- coaching comment must appear under Post-Class Notes, tied to that lesson's
-- date.
--
-- ADDITIVE ONLY: one nullable column on `case_lessons`, one nullable FK column on
-- `case_files`, two CHECK constraints, one partial index and comments. No new
-- table. No grant change and no policy change — both tables keep the posture they
-- were shipped with:
--   case_files    revoke all from anon, authenticated; grant select, insert,
--                 update, delete to service_role; RLS on with deny-all policies
--   case_lessons  RLS posture untouched (no anon/authenticated table grant)
-- Nothing added here is readable by a browser role; the case-scoped server path
-- remains the only reader.
--
-- Model
--   case_lessons.coaching_comment_url
--     A link the tutor attaches to the coaching comment. NULL, or an https URL of
--     8..500 chars. http:// is rejected because this text is rendered to the
--     parent/student — a trailing downgrade to plaintext is not worth accepting.
--     A link is not a file: uploaded files go through `case_files`.
--   case_files.lesson_id
--     Ties a file to exactly one lesson. ON DELETE SET NULL: removing the lesson
--     must not delete the file row (it is still a case file), it only unpins it
--     from that lesson's date. A rematch is a NEW case, so the cascade from
--     tutoring_cases still clears the whole set.
--   case_files_lesson_id_check
--     A lesson-attached file is always Post-Class Notes, so it can never be filed
--     under general / pre_class / homework. The AC-CONV-3 category list itself is
--     unchanged for files whose lesson_id is null.
--
-- Placement
--   A file with lesson_id set is listed under Post-Class Notes on that lesson's
--   date, next to the coaching comment. A link on coaching_comment_url is
--   rendered with the comment on the same date.
--
-- Independent of #767
--   This is not a Super-Drawer log entry (#767) and does not write to it. #767
--   keeps working when this is skipped: a lesson with no coaching_comment_url and
--   no lesson-linked file looks exactly as it did before this migration.
--
-- Backfill
--   None needed: both columns are nullable and every existing row is correctly
--   "no link attached" / "not tied to a lesson". Counts before and after are
--   identical.

-- ---------------------------------------------------------------------------
-- 1. Link attached to the coaching comment (#785 AC-CONV-4)
-- ---------------------------------------------------------------------------
alter table public.case_lessons
  add column if not exists coaching_comment_url text;

do $$
begin
  -- NULL, or an https link of at least 8 chars ('https://' is already 8, so a
  -- bare scheme with no host fails the lower bound) up to 500. `like 'https://%'`
  -- is what keeps http:// and javascript: out; a CHECK is the only place this can
  -- be enforced for every writer, including ops scripts.
  if not exists (
    select 1 from pg_constraint
    where conname = 'case_lessons_coaching_comment_url_check'
      and conrelid = 'public.case_lessons'::regclass
  ) then
    alter table public.case_lessons
      add constraint case_lessons_coaching_comment_url_check
      check (
        coaching_comment_url is null
        or (
          char_length(coaching_comment_url) between 8 and 500
          and coaching_comment_url like 'https://%'
        )
      );
  end if;
end $$;

comment on column public.case_lessons.coaching_comment_url is
  '#785 AC-CONV-4: a file or link attached to a lesson''s coaching comment appears under Post-Class Notes, tied to that lesson date. Independent of the #767 Super-Drawer log, which must still work when this is skipped.';

-- ---------------------------------------------------------------------------
-- 2. File pinned to a lesson (#785 AC-CONV-4)
-- ---------------------------------------------------------------------------
alter table public.case_files
  add column if not exists lesson_id uuid
    references public.case_lessons (id) on delete set null;

do $$
begin
  -- A lesson-attached file is always Post-Class Notes: it cannot be filed in
  -- another area, because the area is implied by the lesson it belongs to.
  -- Files with lesson_id null keep the full AC-CONV-3 category range.
  if not exists (
    select 1 from pg_constraint
    where conname = 'case_files_lesson_id_check'
      and conrelid = 'public.case_files'::regclass
  ) then
    alter table public.case_files
      add constraint case_files_lesson_id_check
      check (lesson_id is null or category = 'post_class');
  end if;
end $$;

comment on column public.case_files.lesson_id is
  '#785 AC-CONV-4: a file or link attached to a lesson''s coaching comment appears under Post-Class Notes, tied to that lesson date. Independent of the #767 Super-Drawer log, which must still work when this is skipped.';

comment on constraint case_files_lesson_id_check on public.case_files is
  '#785 AC-CONV-4: a file or link attached to a lesson''s coaching comment appears under Post-Class Notes, tied to that lesson date. Independent of the #767 Super-Drawer log, which must still work when this is skipped.';

-- ---------------------------------------------------------------------------
-- 3. Index for the Post-Class Notes read path
-- ---------------------------------------------------------------------------
-- Partial: only lesson-linked rows are ever looked up by lesson, and most case
-- files are not lesson-linked, so the index stays small.
create index if not exists idx_case_files_lesson
  on public.case_files (lesson_id)
  where lesson_id is not null;
