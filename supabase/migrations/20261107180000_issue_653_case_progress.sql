-- #653 Progress & Grades. Scores are private to the parties of a case.
-- The target stays on the #637 Demand-Side row (one source): target_grade
-- already lives there, and target_pct joins it for the chart line.
create table if not exists public.case_assessments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.tutoring_cases(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  assessed_on date not null,
  category text not null check (category in ('lesson_quiz', 'past_paper', 'school_exam')),
  marks numeric(7, 2) not null check (marks >= 0),
  max_marks numeric(7, 2) not null check (max_marks > 0 and max_marks <= 10000),
  grade_label text check (char_length(grade_label) <= 12),
  note text check (char_length(note) <= 200),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  check (marks <= max_marks)
);

create index if not exists idx_case_assessments_case_date
  on public.case_assessments (case_id, assessed_on);

revoke all on public.case_assessments from anon, authenticated;
grant select, insert, update, delete on public.case_assessments to service_role;
alter table public.case_assessments enable row level security;

alter table public.case_demand_side
  add column if not exists target_pct smallint check (target_pct between 0 and 100);

comment on table public.case_assessments is
  '#653 assessment log behind the private grade curve; never shown on public profiles.';
comment on column public.case_demand_side.target_pct is
  '#653 target percentage for the Progress chart; shares this row with target_grade (#637).';
