-- Escrow dispute hardening follow-up (#429 V1 core):
--
-- 1. DB-level coherence for the dispute lifecycle. App code now guards every
--    write with predicate+rowCount checks, but a CHECK makes the stranded
--    state (money released/refunded while a dispute is still open) flat-out
--    impossible: staff could never resolve it (disputeRefundTarget /
--    disputeRejectTarget both return null for payable statuses) and the
--    payout export would pay the seller in full while the buyer's dispute
--    badge renders forever. NOT VALID: legacy rows (if any) are not scanned
--    or rewritten, only new/updated rows are checked.
-- 2. material_orders.updated_at was never maintained (column existed since
--    creation, no trigger), so every service-role update (sweep, dispute,
--    release) left it at the creation timestamp.
-- 3. dispute decision audit: decided_by keeps its FK but the "who decided"
--    fact must survive the actor's deletion for a money-moving decision, so
--    the decision is also stamped into decided_by_text.

-- 1. Dispute coherence (open disputes only legal while the money is held or
--    legacy delivered: the two statuses canOpenDispute allows).
ALTER TABLE public.material_orders
  ADD CONSTRAINT material_orders_dispute_open_live_chk
  CHECK (
    dispute_status IS DISTINCT FROM 'open'
    OR status IN ('held', 'delivered')
  ) NOT VALID;

-- 2. Standard updated_at maintenance.
DROP TRIGGER IF EXISTS trg_material_orders_updated_at ON public.material_orders;
CREATE TRIGGER trg_material_orders_updated_at
  BEFORE UPDATE ON public.material_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Deletion-survivable decision audit stamp.
ALTER TABLE public.material_orders
  ADD COLUMN IF NOT EXISTS decided_by_text TEXT;
