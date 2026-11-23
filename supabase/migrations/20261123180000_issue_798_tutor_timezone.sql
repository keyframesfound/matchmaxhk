-- #798: the zone a tutor's weekly availability grid is read in.
--
-- Lesson rows are already timestamptz (absolute); this anchors the grid and
-- any zone label. Asia/Hong_Kong default keeps today's behaviour unchanged
-- for every existing tutor.

alter table public.tutors add column if not exists timezone text not null default 'Asia/Hong_Kong';

create or replace function public.is_valid_timezone(p_zone text)
returns boolean
language sql
stable
set search_path = ''
as $fn$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = p_zone);
$fn$;

alter table public.tutors drop constraint if exists tutors_timezone_valid;
alter table public.tutors
  add constraint tutors_timezone_valid check (public.is_valid_timezone(timezone));