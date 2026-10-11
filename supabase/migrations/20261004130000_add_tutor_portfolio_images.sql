-- Issue #97: Trophy Cabinet — optional public portfolio photos on tutor
-- profiles. Stores R2 public URLs (up to 6, enforced in the intake schema);
-- empty array = section hidden entirely on the public profile.
alter table public.tutors
  add column if not exists portfolio_images text[] not null default '{}';

comment on column public.tutors.portfolio_images is
  'Trophy Cabinet: public portfolio photo URLs (R2), max 6 (JPG/PNG/WebP, 5MB each). Empty array hides the gallery on the public profile.';
