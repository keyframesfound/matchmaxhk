-- #385 billing/invoicing slice — a PAID fee must not block the follow-on invoice.
--
-- uq_case_fees_one_open originally covered ('not_due','invoiced','paid'):
-- "one open fee per case". With the two supported invoicing paths the paid
-- 1.0× Lesson 1 invoice must coexist with the later 0.5× Lesson 2 balance
-- invoice, so 'paid' rows are no longer "open" for the unique-index purpose
-- (a paid row is settled — there is nothing left to collect on it).
-- waived/refunded rows already sat outside the index and stay outside.
--
-- NOT applied by this PR (authored per the #385 slice rules). Apply via
-- Supabase MCP apply_migration after merge; until then the desk's
-- "Invoice 0.5 × Lesson 2 balance" preset surfaces OPEN_FEE_EXISTS on cases
-- whose 1.0× Lesson 1 fee is already paid.
DROP INDEX IF EXISTS public.uq_case_fees_one_open;
CREATE UNIQUE INDEX IF NOT EXISTS uq_case_fees_one_open
  ON public.case_fees (case_id)
  WHERE status IN ('not_due', 'invoiced');
