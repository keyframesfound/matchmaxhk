-- Issue #181: remove email from the case request flow.
-- The form stopped collecting contact_email on 2026-10-04; cases are
-- contacted via phone/WhatsApp and nothing reads this column.
ALTER TABLE public.tutoring_cases
  DROP COLUMN IF EXISTS contact_email;
