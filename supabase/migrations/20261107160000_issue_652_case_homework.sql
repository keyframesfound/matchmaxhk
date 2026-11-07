-- #652 Homework & Submission Tracker. One row per assignment on a matched case.
-- RLS-deny like the rest of the case tables; access only through service-role
-- server fns that check the caller is a party of the case.
create table if not exists public.case_homework (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.tutoring_cases(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  due_at timestamptz not null,
  instructions text check (char_length(instructions) <= 1000),
  resource_url text check (resource_url ~ '^https://' and char_length(resource_url) <= 500),
  target_lesson_id uuid references public.case_lessons(id) on delete set null,
  submitted_at timestamptz,
  submitted_by uuid,
  submission_note text check (char_length(submission_note) <= 500),
  submission_url text check (submission_url ~ '^https://' and char_length(submission_url) <= 500),
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_comment text check (char_length(review_comment) <= 200),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_case_homework_case_due
  on public.case_homework (case_id, due_at);

revoke all on public.case_homework from anon, authenticated;
grant select, insert, update, delete on public.case_homework to service_role;
alter table public.case_homework enable row level security;

comment on table public.case_homework is
  '#652 optional homework tracker, visible only to the parties of the case; never public.';
