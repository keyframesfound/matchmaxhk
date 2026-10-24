-- Issue #217: Profile tags, not a feed. Up to 5 free-text tags per tutor
-- (lowercase, no leading '#', contact-detail-like tags rejected in the app
-- schemas). Stored on tutors so search and the public card read them with
-- the same query; empty array = no tags shown.
alter table public.tutors
  add column if not exists profile_tags text[] not null default '{}';

comment on column public.tutors.profile_tags is
  'Issue #217: up to 5 free-text tutor tags (lowercase, no hash). Searchable from /tutors; clicking a tag searches it.';
