# Academy ledger and slot lock (#530 Phase 0: #532, #534)

Schema and RPCs: `supabase/migrations/20261030130000_issue_532_534_academy_ledger.sql`.
Acceptance: `scripts/test-academy-sql.sh` (Docker; plain Postgres 16 with Supabase stubs).

Managed tier only. Pure-matching cases never get a credit account (#530 §0).

## Decisions

- **HOLD at book.** `confirm_slot_reservation` posts the HOLD when checkout completes.
- **No Redis.** The TTL lock is a `tutor_slot_reservations` row with `expires_at`.
  `reserve_tutor_slot` takes `SELECT … FOR UPDATE` on the tutor row, sweeps that
  tutor's expired holds, then checks overlap against live reservations and
  planned/confirmed `case_lessons`. A GiST exclusion constraint backs it up.
  pg_cron runs `release_expired_slot_reservations()` every minute.
- **Credits** are lesson credits, `numeric(8,2)`.

## Ledger entries

| Type | amount (available) | held_delta | Writer |
| --- | --- | --- | --- |
| PURCHASE | +n | 0 | admin / payments |
| HOLD | −n | +n | confirm at book |
| RELEASE | +n | −n | cancel in policy, absent excused |
| CONSUME | 0 | −n | present, late, left early, absent billable |
| ADJUSTMENT | ±n | 0 | admin only |

Invariants: `sum(amount) = balance`, `sum(held_delta) = held`. Rows are append-only
(trigger). Each `idempotency_key` posts once. A hold settles once
(`uq_credit_ledger_hold_settled_once`): a repeat CONSUME returns the existing row,
and a RELEASE after CONSUME raises `HOLD_ALREADY_SETTLED`. A negative balance needs
`admin_override` from an admin actor.

`async_deliverables` (#534) uses the same HOLD/CONSUME path through
`credit_ledger_entries.deliverable_id`.

## Error codes

`SLOT_TAKEN`, `SLOT_IN_PAST`, `RESERVATION_EXPIRED`, `RESERVATION_NOT_FOUND`,
`RESERVATION_CONFIRMED`, `INSUFFICIENT_CREDITS`, `HOLD_NOT_FOUND`,
`HOLD_ALREADY_SETTLED`, `IDEMPOTENCY_KEY_REUSED`, `ADJUSTMENT_ADMIN_ONLY`.
