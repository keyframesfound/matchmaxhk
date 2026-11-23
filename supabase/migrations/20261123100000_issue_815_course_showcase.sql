-- Issue #815 §2.5 Course Showcase (Enquire only)
-- Additive only: new nullable/defaulted columns, constraints and a guard trigger.
-- No drops, no renames, no data migration, no RLS policy changes.

-- 1) Course showcase content columns -----------------------------------------
alter table public.courses
  add column if not exists curriculum text,
  add column if not exists target_grade text,
  add column if not exists format text,
  add column if not exists schedule_summary text,
  add column if not exists price_display text,
  add column if not exists trial_available boolean not null default false,
  add column if not exists highlights text[] not null default '{}'::text[],
  add column if not exists instruction_languages text[] not null default '{}'::text[],
  add column if not exists assigned_tutor_id uuid;

-- 2) Constraints on public.courses -------------------------------------------
alter table public.courses
  add constraint courses_format_check
    check (format is null or format in ('small_group', 'bootcamp', 'one_on_one_centre', 'admissions_consultation'));

alter table public.courses
  add constraint courses_schedule_summary_len
    check (schedule_summary is null or char_length(schedule_summary) <= 100);

alter table public.courses
  add constraint courses_price_display_len
    check (price_display is null or char_length(price_display) <= 40);

alter table public.courses
  add constraint courses_highlights_card
    check (cardinality(highlights) <= 3);

alter table public.courses
  add constraint courses_languages_check
    check (instruction_languages <@ array['english', 'cantonese', 'mandarin']::text[]);

-- 3) Guard the optional assigned tutor: must be an approved affiliated tutor
--    of the course's own centre.
create or replace function public.guard_course_assigned_tutor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.assigned_tutor_id is not null then
    if not exists (
      select 1
      from public.centre_affiliations as ca
      where ca.centre_id = new.organization_id
        and ca.user_id = new.assigned_tutor_id
        and ca.role_type = 'affiliated_tutor'
        and ca.status = 'approved'
    ) then
      raise exception 'assigned_tutor_id % is not an approved affiliated tutor of centre %',
        new.assigned_tutor_id, new.organization_id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_courses_assigned_tutor on public.courses;
create trigger trg_courses_assigned_tutor
  before insert or update of assigned_tutor_id, organization_id
  on public.courses
  for each row
  execute function public.guard_course_assigned_tutor();

-- 4) Centre course-enquiry lead columns on tutoring_cases --------------------
alter table public.tutoring_cases
  add column if not exists course_id uuid references public.courses(id) on delete set null,
  add column if not exists contact_email text,
  add column if not exists requested_tutor_id uuid;

-- 5) Indexes for course enquiries --------------------------------------------
create index if not exists idx_tutoring_cases_course
  on public.tutoring_cases(course_id);

create index if not exists idx_tutoring_cases_org_created
  on public.tutoring_cases(organisation_id, created_at desc);
