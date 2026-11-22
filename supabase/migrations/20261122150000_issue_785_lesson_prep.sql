-- Issue #785 AC-735-2a — an upcoming lesson can show a topic / prep note.
--
-- ADDITIVE ONLY: two nullable columns on the existing `case_lessons` row, plus
-- their length checks and column comments. No new table, no grants change, no
-- policy change — `case_lessons` keeps its existing posture exactly as it is.
--
-- Model
--   lesson_topic  short label a tutor puts on one upcoming lesson ("Quadratic
--                 inequalities"), shown to both case parties in the Case
--                 Workspace. 1-80 chars after trimming; NULL = no topic set.
--   prep_note     optional one-liner of what to bring / prepare beforehand.
--                 <= 500 chars; NULL = nothing to add.
--
-- Visibility
--   Both fields are authored by the tutor and are intended to be visible to the
--   case parties (parent / student / matched tutor / Ops), unlike the existing
--   tutor-private `private_note`, which this migration deliberately does not
--   touch. That is still never public: reads continue to go through the existing
--   case-scoped access path on `case_lessons`, not a new open surface.
--   `private_note` is the private field; everything here is shareable.
--
-- Backfill
--   None needed: both columns are nullable and every existing row is correctly
--   "no topic / no prep note".

-- ---------------------------------------------------------------------------
-- Columns (guard-first, so a re-apply is a no-op)
-- ---------------------------------------------------------------------------
alter table public.case_lessons add column if not exists lesson_topic text;
alter table public.case_lessons add column if not exists prep_note text;

do $$
begin
  -- lesson_topic: NULL, or 1-80 chars when trimmed. Trimming first means a
  -- whitespace-only string ("   ") is rejected rather than stored as a blank
  -- label, while the stored value keeps the tutor's own spacing.
  if not exists (
    select 1 from pg_constraint where conname = 'case_lessons_lesson_topic_check'
  ) then
    alter table public.case_lessons
      add constraint case_lessons_lesson_topic_check
      check (
        lesson_topic is null
        or char_length(btrim(lesson_topic)) between 1 and 80
      );
  end if;

  -- prep_note: NULL, or at most 500 chars. Mirrors the existing
  -- `case_lessons_private_note_check` bound so both note fields read the same.
  if not exists (
    select 1 from pg_constraint where conname = 'case_lessons_prep_note_check'
  ) then
    alter table public.case_lessons
      add constraint case_lessons_prep_note_check
      check (prep_note is null or char_length(prep_note) <= 500);
  end if;
end $$;

comment on column public.case_lessons.lesson_topic is
  '#785 AC-735-2: pre-lesson topic, shown to both case parties (never public). NULL = no topic set.';

comment on column public.case_lessons.prep_note is
  '#785 AC-735-2: pre-lesson prep note for the upcoming lesson, shown to both case parties (never public). NULL = nothing to add.';
