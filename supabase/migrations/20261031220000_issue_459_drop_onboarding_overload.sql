-- Issue #459 slice 9: drop the stale single-arg complete_onboarding.
--
-- 20261031180000 added complete_onboarding(_choice, _display_name) with
-- CREATE OR REPLACE, which created an overload instead of replacing the
-- slice 1 complete_onboarding(_choice) signature. The app always sends both
-- args (OnboardingGate.tsx), but a one-arg call would be ambiguous and the
-- old body still pins active_role on every call. Drop it so the zero-lock-in
-- version is the only entry point.

DROP FUNCTION IF EXISTS public.complete_onboarding(TEXT);
