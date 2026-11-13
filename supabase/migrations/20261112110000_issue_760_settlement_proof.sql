-- Issue #760 Part 3 (was #756) — Admin Fee Settlement Bridge proof states.
--
-- The #259 fee desk already carries the tutor-facing FPS card (Chan Hau Yui
-- / 6199-1509 / HSBC 563-440361-833, MM-<case_code> reference) with ONE
-- screenshot upload and staff mark-paid. This migration adds the missing
-- settlement state machine on top of case_fees (no new table, no money
-- movement):
--   proof_status 'submitted'  → tutor uploaded an FPS receipt; the card
--                               shows Pending Verification (amber)
--   proof_status 'rejected'   → ops requested a re-upload (with a note);
--                               the tutor may replace the screenshot and
--                               the >72h overdue soft-gate clock gains +24h
--   payment_due / settled stay the EXISTING invoiced / paid statuses
--
-- case_fees is service-role only (no authenticated grants); these internal
-- columns never reach parent payloads.
alter table public.case_fees
  add column if not exists proof_status text not null default 'none',
  add column if not exists proof_rejected_at timestamptz,
  add column if not exists proof_reject_note text;

alter table public.case_fees drop constraint if exists case_fees_proof_status_chk;
alter table public.case_fees add constraint case_fees_proof_status_chk
  check (proof_status in ('none', 'submitted', 'rejected'));

-- A rejection always carries its instant and a one-line ops note (and vice
-- versa); 'none'/'submitted' carry neither.
alter table public.case_fees drop constraint if exists case_fees_proof_reject_pair_chk;
alter table public.case_fees add constraint case_fees_proof_reject_pair_chk
  check (
    (
      proof_status = 'rejected'
      AND proof_rejected_at IS NOT NULL
      AND proof_reject_note IS NOT NULL
    )
    OR (proof_status <> 'rejected' AND proof_rejected_at IS NULL AND proof_reject_note IS NULL)
  );

comment on column public.case_fees.proof_status is
  '#760 Part 3 settlement proof state: none (payment_due) / submitted (pending_verification, ops verifies the FPS receipt) / rejected (re-upload requested, +24h on the 72h overdue clock).';
comment on column public.case_fees.proof_reject_note is
  '#760 ops one-liner sent with the re-upload request (e.g. blurry screenshot).';
