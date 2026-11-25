-- Issue #798 (AC-2): optional matching chips on the tutor join form.
--
-- Three optional selections land on the tutors row after publish: teaching
-- style, student fit and specialty syllabus tags. An empty array means "not
-- specified" and must never block intake or publishing, so the columns are
-- NOT NULL with an empty default and only the upper caps are constrained.
--
-- Additive and re-runnable: the columns use IF NOT EXISTS and each CHECK is
-- dropped before it is re-added, so this file can be applied to any database
-- that already carries a partial version of the work.

alter table public.tutors add column if not exists tutoring_styles text[] not null default '{}';

alter table public.tutors add column if not exists student_fit text[] not null default '{}';

alter table public.tutors add column if not exists syllabus_tags text[] not null default '{}';

comment on column public.tutors.tutoring_styles is
  '#798 AC-2: optional teaching-style chips from the join form, max 3 (tutors_tutoring_styles_max). Empty = not specified, never blocks publishing.';

comment on column public.tutors.student_fit is
  '#798 AC-2: optional student-fit chips from the join form, max 3 (tutors_student_fit_max). Empty = not specified, never blocks publishing.';

comment on column public.tutors.syllabus_tags is
  '#798 AC-2: optional specialty syllabus tags from the join form, max 5 (tutors_syllabus_tags_max). Provisional vocabulary, reconcile with the shared tag source when #796 ships. Empty = not specified.';

alter table public.tutors drop constraint if exists tutors_tutoring_styles_max;
alter table public.tutors
  add constraint tutors_tutoring_styles_max check (cardinality(tutoring_styles) <= 3);

alter table public.tutors drop constraint if exists tutors_student_fit_max;
alter table public.tutors
  add constraint tutors_student_fit_max check (cardinality(student_fit) <= 3);

alter table public.tutors drop constraint if exists tutors_syllabus_tags_max;
alter table public.tutors
  add constraint tutors_syllabus_tags_max check (cardinality(syllabus_tags) <= 5);
