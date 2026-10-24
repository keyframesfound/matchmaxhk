-- Issue #253 (F2): the case-request form gains a matching-fee agreement
-- checkbox (version fee-2026-10). The acceptance row is written
-- service-role by submitCaseRequest through recordTermsAcceptance, so the
-- surface allowlist on terms_acceptances needs the new gated surface.

ALTER TABLE public.terms_acceptances
  DROP CONSTRAINT terms_acceptances_surface_check;
ALTER TABLE public.terms_acceptances
  ADD CONSTRAINT terms_acceptances_surface_check
  CHECK (surface = ANY (ARRAY['signup'::text, 'note_upload'::text, 'checkout'::text, 'referral_signup'::text, 'case_request'::text]));
