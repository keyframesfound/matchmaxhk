# Referral and agent cash rule (#625)

The written rule behind the referral ledger, from the 2026-11-03 CEO lock.
This file is the in-repo copy; the Master Sheet and Handbook remain the ops
source.

## Base = the cash MatchMax actually collected

Referral and agent cash is a share of the **final admin fee MatchMax collected**
for the case, never of a notional full 1.5x.

| Role | Rate | Base |
| --- | --- | --- |
| Tutor referrer / tutor agent | 15% | final collected MatchMax admin take |
| Sales agent / org referral | 30% | final collected MatchMax admin take |

Every reduced-take path follows the collected amount:

| Path | MatchMax take (R = lesson rate) | Tutor 15% | Sales 30% |
| --- | --- | --- | --- |
| Standard (L1 + L2) | 1.5 x R | 0.225 x R | 0.45 x R |
| Verified drop (#520) | 0.5 x R | 0.075 x R | 0.15 x R |
| Edge Case 1 stop after L1 | 1.0 x R | 0.15 x R | 0.30 x R |
| Short package (#443) | 20% of package | 15% of that | 30% of that |

## Payout gate

A bounty may only move to `ready_for_payout` or `paid` when **both** hold:

1. The admin fee for the source case has been **collected** (a paid
   `case_fees` row, or the legacy fee mirror when the case has no SoR fee row).
2. **Either**
   - A. Lesson 1 and Lesson 2 are both `done`, **or**
   - B. the case settled with a known final take (`sor_status` = `fee_paid`,
     `active`, `replaced`, `closed`, or legacy status `closed` / `replaced`),
     **or** a short package whose scheduled lessons are all done.

A waived or refunded fee with no paid row left **voids** a pending or cleared
bounty. Until the gate opens, the bounty stays `pending`.

## Where it is enforced

- `referral_payout_gate(bounty_id)` — the predicate, returning a stable reason
  code (`FEE_NOT_COLLECTED`, `PAYOUT_GATE_NOT_MET`, `CASE_SETTLED`, …).
- `trg_referral_bounty_payout_gate` — a BEFORE UPDATE trigger on
  `referral_bounties.status`, so the admin table, a manual SQL update, or any
  future surface all obey the gate.
- `trg_case_fees_void_referral_bounty` — voids the bounty when its fee is
  waived or refunded before collection.
- The 15% amount itself is still computed by
  `create_referral_bounty_on_fee()` from the collected `fee_amount_cents`
  (or the paid `case_fees` mirror), so a reduced take pays a reduced bounty.

The 30% sales-agent / org-referral lane has no payee entity in the product yet;
it is tracked in the Master Sheet and must use the same gate and the same
collected-take base.
