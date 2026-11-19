-- #782 §2.2 (was #755): optional SCRC Ready self-declaration + the parent's
-- soft preference on face-to-face K-12 requests. Never stores a certificate,
-- enquiry code or HKID. Additive only.

alter table public.tutors
  add column if not exists scrc_ready boolean not null default false;

alter table public.tutoring_cases
  add column if not exists prefer_scrc_tutor boolean not null default false;
