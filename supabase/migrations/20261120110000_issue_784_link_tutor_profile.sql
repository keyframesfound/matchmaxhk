-- #784 §2.6: per-listing switch for the shipped #731 "Request this tutor for
-- 1-on-1" CTA. Default on (only shown when the seller has a tutor profile).
alter table public.digital_materials
  add column if not exists link_tutor_profile boolean not null default true;
