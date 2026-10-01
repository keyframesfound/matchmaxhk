-- Issue #142: two-tier "Verified" badge support on tutor profiles.
--
-- verification_tier is NULL (or 'tier_1_standard') for regular self-reported
-- profiles; 'tier_2_verified' marks profiles whose transcripts + HKID passed
-- the manual admin review (the gold "Verified Scholar Badge"). The /tutors
-- directory gains a default-off "Verified Tutors Only" filter keyed on this
-- column, and admins set it from the Tutor Editor next to Tutor Status.
ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS verification_tier TEXT
  CHECK (verification_tier IN ('tier_1_standard', 'tier_2_verified'));

COMMENT ON COLUMN public.tutors.verification_tier IS
  'Two-tier verification: NULL/tier_1_standard = self-reported (Stated Qualifications); tier_2_verified = transcripts + HKID manually reviewed by admins (Verified Scholar Badge).';
