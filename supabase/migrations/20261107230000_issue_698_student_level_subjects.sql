-- #698 Search "Who is learning?": child profiles carry a grade level and
-- target subjects so the tutor feed can soft-boost compatible tutors and the
-- Case Request form can pre-fill. Additive and optional.
--   level     kindergarten | p1..p6 | s1..s6 | y7..y13 | university
--   subjects  target subjects (same vocabulary as the case form)
alter table public.students
  add column if not exists level text,
  add column if not exists subjects text[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'students_level_chk') then
    alter table public.students
      add constraint students_level_chk check (
        level is null or level ~ '^(kindergarten|university|p[1-6]|s[1-6]|y([7-9]|1[0-3]))$'
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'students_subjects_len_chk') then
    alter table public.students
      add constraint students_subjects_len_chk check (coalesce(array_length(subjects, 1), 0) <= 8);
  end if;
end $$;
