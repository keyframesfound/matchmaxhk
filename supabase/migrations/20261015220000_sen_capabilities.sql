-- Issue #199: SEN (Special Educational Needs) capabilities.
-- Additive only: tutor capability profile + case request SEN requirements.

-- Tutor side: self-reported SEN experience, the HK-common category
-- vocabulary (src/features/tutors/sen.ts) and a free-text experience /
-- qualifications note shown on the profile.
alter table public.tutors
  add column if not exists sen_enabled boolean not null default false;

alter table public.tutors
  add column if not exists sen_categories text[] not null default '{}';

alter table public.tutors
  add column if not exists sen_experience text;

-- Case side: does the student require SEN support, which categories, and the
-- parent's additional details. sen_details is internal/matching-only and is
-- deliberately NOT part of the public board column whitelist.
alter table public.tutoring_cases
  add column if not exists sen_required boolean not null default false;

alter table public.tutoring_cases
  add column if not exists sen_categories text[] not null default '{}';

alter table public.tutoring_cases
  add column if not exists sen_details text;

-- The /tutors SEN filter resolves sen_enabled + sen_categories for every
-- listed tutor row.
create index if not exists tutors_sen_enabled_idx
  on public.tutors (sen_enabled)
  where sen_enabled;
