-- #259 (O1) Fee desk: the payer (matched tutor, tutor-pays #444) attaches one
-- FPS payment screenshot to an invoiced case_fees row; staff mark paid and a
-- receipt email goes out once.
--
-- The screenshot lives in the existing private orders-screenshots bucket under
-- case-fees/… (service-role only); only staff read it via a signed URL.
--
-- "The same FPS reference cannot close two cases" is enforced by a trigger:
-- the L1 and L2 invoices of ONE case legitimately share the case-code memo,
-- so a plain unique index on fps_reference would be wrong.
--
-- Apply via Supabase MCP apply_migration after merge.

ALTER TABLE public.case_fees
  ADD COLUMN IF NOT EXISTS payment_screenshot_path text,
  ADD COLUMN IF NOT EXISTS payment_screenshot_at timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_sent_at timestamptz;

COMMENT ON COLUMN public.case_fees.payment_screenshot_path IS
  '#259: payer FPS proof in orders-screenshots/case-fees/…; staff-only via signed URL.';

CREATE OR REPLACE FUNCTION public.guard_case_fee_reference_unique()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _key text;
BEGIN
  IF NEW.status <> 'paid' OR NEW.fps_reference IS NULL THEN
    RETURN NEW;
  END IF;
  _key := regexp_replace(upper(regexp_replace(NEW.fps_reference, '\s', '', 'g')), '^MM-', '');
  IF length(_key) < 3 THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.case_fees f
    WHERE f.status = 'paid'
      AND f.case_id <> NEW.case_id
      AND f.fps_reference IS NOT NULL
      AND regexp_replace(upper(regexp_replace(f.fps_reference, '\s', '', 'g')), '^MM-', '') = _key
  ) THEN
    RAISE EXCEPTION 'FPS_REFERENCE_USED' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_case_fee_reference_unique ON public.case_fees;
CREATE TRIGGER trg_case_fee_reference_unique
  BEFORE INSERT OR UPDATE OF status, fps_reference ON public.case_fees
  FOR EACH ROW EXECUTE FUNCTION public.guard_case_fee_reference_unique();
