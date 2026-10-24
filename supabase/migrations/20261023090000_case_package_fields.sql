-- Issue #423 (B2C sections 2+3) — structured case package fields.
-- Additive only: three displayable columns on tutoring_cases that kill the
-- free-text-title / random-input problem at the data layer.
--   package_type  — fee rule the card footer pill renders
--                   ('ongoing_1_5' → 1.5-Lesson, 'short_20' → 20% Short,
--                    'pro_bono'    → Pro-Bono $0)
--   student_count — card shows "N students" only when > 1
--   rate_unit     — suffix fed to the #426 rate formatter (/hr|/lesson|/month)
-- All three default sensibly so every legacy row stays valid untouched.
ALTER TABLE tutoring_cases
  ADD COLUMN IF NOT EXISTS package_type text NOT NULL DEFAULT 'ongoing_1_5'
    CHECK (package_type IN ('ongoing_1_5', 'short_20', 'pro_bono'));

ALTER TABLE tutoring_cases
  ADD COLUMN IF NOT EXISTS student_count integer NOT NULL DEFAULT 1
    CHECK (student_count >= 1);

ALTER TABLE tutoring_cases
  ADD COLUMN IF NOT EXISTS rate_unit text NOT NULL DEFAULT 'hr'
    CHECK (rate_unit IN ('hr', 'lesson', 'month'));
