-- Issue #437: client avatars & case-level student details.
-- Demographics live on the CASE (never the account):
--   who_for         — "Who is this for?" (My child | Myself | Someone else)
--   student_gender  — case-level student gender on the intake form
-- text + CHECK (not enum) to match class_format_preference and keep prod
-- enum drift out of the critical path. Nullable: legacy rows pre-date the
-- columns; new website inserts always populate both.
alter table public.tutoring_cases
  add column if not exists who_for text
    check (who_for in ('my_child', 'myself', 'someone_else')),
  add column if not exists student_gender text
    check (student_gender in ('female', 'male', 'prefer_not_to_say'));
