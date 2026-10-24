-- Issue #345 — soft nits deferred from PR #343 (tutor rates, #319).
--
-- 1. trg_tutors_normalize_hkd listed rate_rows / travel_note / rate_note in
--    UPDATE OF, but tutors_normalize_hkd() only reads the base rates and the
--    legacy inputs (currency, hourly_rate, pricing_tiers, online_rate,
--    inperson_rate). Editing the profile-only rate rows fired the trigger for
--    nothing. Narrow the UPDATE column list to what the function reads.
--    Function body is unchanged — the CREATE OR REPLACE in 20261014120000
--    stands; only the trigger is dropped and recreated.
-- 2. DB-level shape guardrail on tutors.rate_rows: it must be NULL or a JSON
--    array ([{label, rate}], max 6 at the app layer). Shape-level only —
--    element contents stay app-layer.

DROP TRIGGER IF EXISTS trg_tutors_normalize_hkd ON public.tutors;
CREATE TRIGGER trg_tutors_normalize_hkd
  BEFORE INSERT OR UPDATE OF currency, hourly_rate, pricing_tiers,
    online_rate, inperson_rate
  ON public.tutors
  FOR EACH ROW EXECUTE FUNCTION public.tutors_normalize_hkd();

-- Idempotent: fresh constraint name, added only when absent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tutors_rate_rows_array_chk'
      AND conrelid = 'public.tutors'::regclass
  ) THEN
    ALTER TABLE public.tutors
      ADD CONSTRAINT tutors_rate_rows_array_chk
        CHECK (rate_rows IS NULL OR jsonb_typeof(rate_rows) = 'array');
  END IF;
END
$$;
