#!/usr/bin/env bash
# #532 Phase 0 + #533 Phase 1 acceptance: runs the academy ledger migration on a throwaway
# Postgres 16 container and checks slot-lock concurrency, ledger invariants,
# idempotency and TTL release. Needs Docker. Usage: scripts/test-academy-sql.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAME="mm-academy-pg-test"
MIGRATION="$ROOT/supabase/migrations/20261030130000_issue_532_534_academy_ledger.sql"
MIGRATION_533="$ROOT/supabase/migrations/20261031090000_issue_533_attendance_ledger.sql"
RACE_DIR="$(mktemp -d)"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; rm -rf "$RACE_DIR"; }
trap cleanup EXIT
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD=pg postgres:16-alpine >/dev/null
for _ in $(seq 1 30); do docker exec "$NAME" pg_isready -U postgres -q && break; sleep 1; done
sleep 1

psql_q() { docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -qtAX "$@"; }
fail() { echo "FAIL: $1"; exit 1; }
pass() { echo "ok   $1"; }

psql_q < "$ROOT/tests/sql/academy-stubs.sql"
psql_q < "$MIGRATION" 2>/dev/null
psql_q < "$MIGRATION_533" 2>/dev/null

# Fixture: one tutor, one student account with 3 credits.
read -r TUTOR STUDENT ACCOUNT < <(psql_q -F ' ' <<'SQL'
WITH t AS (INSERT INTO public.tutors DEFAULT VALUES RETURNING id),
     s AS (INSERT INTO public.students (display_name) VALUES ('Test student') RETURNING id),
     a AS (INSERT INTO public.credit_accounts (student_id, tutor_id)
           SELECT s.id, t.id FROM s, t RETURNING id, student_id, tutor_id)
SELECT tutor_id, student_id, id FROM a;
SQL
)
psql_q -c "SELECT public.post_credit_entry('$ACCOUNT','PURCHASE',3,'purchase:fixture-1',NULL,'admin');" >/dev/null

# 1. Concurrency: two parents race for the same slot. Session A holds the
#    tutor lock for 2s; session B starts mid-way and must fail cleanly.
SLOT="now() + interval '2 days'"
RACE_SQL="BEGIN; SELECT public.reserve_tutor_slot('$TUTOR', date_trunc('hour', $SLOT), 60, '$STUDENT', NULL, 600); SELECT pg_sleep(2); COMMIT;"
( docker exec "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -qtAX -c "$RACE_SQL" >"$RACE_DIR/a.out" 2>&1; echo $? >"$RACE_DIR/a.rc" ) &
sleep 0.5
set +e
B_OUT=$(docker exec "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -qtAX -c "SELECT public.reserve_tutor_slot('$TUTOR', date_trunc('hour', $SLOT) + interval '30 minutes', 60, '$STUDENT', NULL, 600);" 2>&1)
B_RC=$?
set -e
wait
[ "$(cat "$RACE_DIR/a.rc")" = "0" ] || fail "winner did not reserve: $(cat "$RACE_DIR/a.out")"
[ "$B_RC" != "0" ] && echo "$B_OUT" | grep -q SLOT_TAKEN || fail "loser did not get SLOT_TAKEN: $B_OUT"
LIVE=$(psql_q -c "SELECT count(*) FROM public.tutor_slot_reservations WHERE status='held';")
[ "$LIVE" = "1" ] || fail "expected 1 live reservation, got $LIVE"
pass "two parents same slot -> one wins, one SLOT_TAKEN"

# 2. Exclusion constraint holds even if a caller bypasses the RPC.
set +e
RAW=$(psql_q -c "INSERT INTO public.tutor_slot_reservations (tutor_id, starts_at, ends_at, expires_at)
  VALUES ('$TUTOR', date_trunc('hour', $SLOT), date_trunc('hour', $SLOT) + interval '1 hour', now() + interval '10 minutes');" 2>&1)
set -e
echo "$RAW" | grep -q tutor_slot_reservations_no_overlap || fail "raw overlapping insert was allowed"
pass "raw overlapping insert blocked by exclusion constraint"

# 3. Confirm = HOLD at book; retried confirm does not double-hold.
TOKEN=$(psql_q -c "SELECT reservation_token FROM public.tutor_slot_reservations WHERE status='held';")
psql_q -c "SELECT public.confirm_slot_reservation('$TOKEN','$ACCOUNT',1,NULL,'parent');" >/dev/null
psql_q -c "SELECT public.confirm_slot_reservation('$TOKEN','$ACCOUNT',1,NULL,'parent');" >/dev/null
HOLDS=$(psql_q -c "SELECT count(*) FROM public.credit_ledger_entries WHERE entry_type='HOLD';")
[ "$HOLDS" = "1" ] || fail "expected 1 HOLD, got $HOLDS"
read -r BAL HELD < <(psql_q -F ' ' -c "SELECT balance, held FROM public.credit_accounts WHERE id='$ACCOUNT';")
[ "$BAL" = "2.00" ] && [ "$HELD" = "1.00" ] || fail "after HOLD expected 2/1, got $BAL/$HELD"
pass "HOLD at book; retried confirm is idempotent"

# 4. Duplicate attendance submit / webhook: CONSUME twice (new keys) -> one consume.
HOLD_ID=$(psql_q -c "SELECT id FROM public.credit_ledger_entries WHERE entry_type='HOLD';")
psql_q -c "SELECT public.post_credit_entry('$ACCOUNT','CONSUME',NULL,'attendance:submit-1',NULL,'tutor','$HOLD_ID');" >/dev/null
psql_q -c "SELECT public.post_credit_entry('$ACCOUNT','CONSUME',NULL,'attendance:submit-2',NULL,'tutor','$HOLD_ID');" >/dev/null
psql_q -c "SELECT public.post_credit_entry('$ACCOUNT','CONSUME',NULL,'attendance:submit-1',NULL,'tutor','$HOLD_ID');" >/dev/null
CONSUMES=$(psql_q -c "SELECT count(*) FROM public.credit_ledger_entries WHERE entry_type='CONSUME';")
[ "$CONSUMES" = "1" ] || fail "expected 1 CONSUME, got $CONSUMES"
set +e
REL=$(psql_q -c "SELECT public.post_credit_entry('$ACCOUNT','RELEASE',NULL,'release:after-consume',NULL,'admin','$HOLD_ID');" 2>&1)
set -e
echo "$REL" | grep -q HOLD_ALREADY_SETTLED || fail "release after consume not rejected: $REL"
pass "duplicate attendance / webhook never double-consumes"

# 5. No negative balance without admin override.
set +e
NEG=$(psql_q -c "SELECT public.post_credit_entry('$ACCOUNT','HOLD',5,'hold:too-much',NULL,'parent');" 2>&1)
set -e
echo "$NEG" | grep -q INSUFFICIENT_CREDITS || fail "negative hold allowed: $NEG"
psql_q -c "SELECT public.post_credit_entry('$ACCOUNT','ADJUSTMENT',-3,'adjust:override-1',NULL,'admin',NULL,NULL,NULL,true,'Goodwill test');" >/dev/null
pass "negative balance only with admin override"

# 6. Invariant: sum(entries) = cached balance; ledger rows are append-only.
INV=$(psql_q -c "SELECT bool_and(a.balance = s.amt AND a.held = s.hd) FROM public.credit_accounts a
  JOIN (SELECT account_id, sum(amount) amt, sum(held_delta) hd FROM public.credit_ledger_entries GROUP BY 1) s
  ON s.account_id = a.id;")
[ "$INV" = "t" ] || fail "sum(entries) != balance"
set +e
UPD=$(psql_q -c "UPDATE public.credit_ledger_entries SET amount = 99;" 2>&1)
DEL=$(psql_q -c "DELETE FROM public.credit_ledger_entries;" 2>&1)
set -e
echo "$UPD" | grep -q append-only && echo "$DEL" | grep -q append-only || fail "ledger is mutable"
pass "sum(entries) = balance; ledger append-only"

# 7. Abandoned checkout releases the slot within TTL.
SLOT2="date_trunc('hour', now() + interval '3 days')"
psql_q -c "SELECT public.reserve_tutor_slot('$TUTOR', $SLOT2, 60, '$STUDENT', NULL, 30);" >/dev/null
psql_q -c "UPDATE public.tutor_slot_reservations SET expires_at = now() - interval '1 second' WHERE starts_at = $SLOT2;"
SWEPT=$(psql_q -c "SELECT public.release_expired_slot_reservations();")
[ "$SWEPT" = "1" ] || fail "sweep released $SWEPT"
psql_q -c "SELECT public.reserve_tutor_slot('$TUTOR', $SLOT2, 60, '$STUDENT', NULL, 600);" >/dev/null
EXP_TOKEN=$(psql_q -c "SELECT reservation_token FROM public.tutor_slot_reservations WHERE status='expired' LIMIT 1;")
set +e
LATE=$(psql_q -c "SELECT public.confirm_slot_reservation('$EXP_TOKEN','$ACCOUNT',1,NULL,'parent');" 2>&1)
set -e
echo "$LATE" | grep -q RESERVATION_EXPIRED || fail "expired token confirmed: $LATE"
pass "abandoned checkout releases the slot; expired token cannot confirm"

# 8. #534: async deliverable shares the HOLD/CONSUME path.
psql_q -c "SELECT public.post_credit_entry('$ACCOUNT','PURCHASE',2,'purchase:fixture-2',NULL,'admin');" >/dev/null
DID=$(psql_q -c "INSERT INTO public.async_deliverables (student_id, tutor_id, deliverable_type, sla_deadline_utc)
  VALUES ('$STUDENT','$TUTOR','IA', now() + interval '5 days') RETURNING id;" | head -1)
DH=$(psql_q -c "SELECT (public.post_credit_entry('$ACCOUNT','HOLD',1,'hold:deliverable-$DID',NULL,'parent',NULL,NULL,'$DID')).id;")
psql_q -c "UPDATE public.async_deliverables SET credit_ledger_id = '$DH' WHERE id = '$DID';"
LINKED=$(psql_q -c "SELECT (public.post_credit_entry('$ACCOUNT','CONSUME',NULL,'consume:deliverable-$DID',NULL,'tutor','$DH')).deliverable_id;")
[ "$LINKED" = "$DID" ] || fail "consume did not carry deliverable_id"
pass "async_deliverables HOLD -> CONSUME via ledger"

# ---------------------------------------------------------------------------
# #533 Phase 1: managed lessons drive the ledger through case_lessons.
# ---------------------------------------------------------------------------
read -r MCASE MACC < <(psql_q -F ' ' <<SQL
WITH s AS (INSERT INTO public.students (display_name) VALUES ('Managed student') RETURNING id),
     a AS (INSERT INTO public.credit_accounts (student_id, tutor_id) SELECT s.id, '$TUTOR' FROM s RETURNING id),
     c AS (INSERT INTO public.tutoring_cases (managed, credit_account_id) SELECT true, a.id FROM a RETURNING id, credit_account_id)
SELECT id, credit_account_id FROM c;
SQL
)
psql_q -c "SELECT public.post_credit_entry('$MACC','PURCHASE',3,'purchase:managed-1',NULL,'admin');" >/dev/null
lesson() { psql_q -c "INSERT INTO public.case_lessons (case_id, sequence, tutor_id, starts_at) VALUES ('$MCASE', $1, '$TUTOR', now() + interval '$1 days' + interval '9 days') RETURNING id;" | head -1; }
bal() { psql_q -F ' ' -c "SELECT balance, held FROM public.credit_accounts WHERE id='$MACC';"; }

L1=$(lesson 1)
[ "$(bal)" = "2.00 1.00" ] || fail "booking did not HOLD: $(bal)"
psql_q -c "UPDATE public.case_lessons SET status='done', attendance='present', attendance_note='Worked on quadratics. Next week we start functions.' WHERE id='$L1';"
psql_q -c "UPDATE public.case_lessons SET attendance='late' WHERE id='$L1';"
read -r B H < <(bal)
PAY=$(psql_q -c "SELECT payout_status FROM public.case_lessons WHERE id='$L1';")
[ "$B $H" = "2.00 0.00" ] && [ "$PAY" = "pending_payout" ] || fail "present did not CONSUME once: $B $H $PAY"
pass "managed lesson: HOLD at book -> CONSUME on attendance, once, PENDING_PAYOUT"

L2=$(lesson 2)
psql_q -c "UPDATE public.case_lessons SET status='cancelled', attendance='absent_excused', note_skipped=true WHERE id='$L2';"
[ "$(bal)" = "2.00 0.00" ] || fail "absent_excused did not RELEASE: $(bal)"
pass "absent excused / cancel -> RELEASE"

psql_q -c "UPDATE public.tutoring_cases SET cancellation_policy='{\"late_cancel_billable\": false}' WHERE id='$MCASE';"
L3=$(lesson 3)
psql_q -c "UPDATE public.case_lessons SET status='late_cancel' WHERE id='$L3';"
[ "$(bal)" = "2.00 0.00" ] || fail "non-billable late cancel did not RELEASE: $(bal)"
pass "late cancel follows cancellation_policy (data, not code)"

L4=$(lesson 4)
set +e
SKIP=$(psql_q -c "UPDATE public.case_lessons SET status='done', attendance='present', note_skipped=true WHERE id='$L4';" 2>&1)
set -e
echo "$SKIP" | grep -q NOTE_SKIP_USED || fail "second note skip allowed: $SKIP"
psql_q -c "UPDATE public.case_lessons SET status='done', attendance='present', note_skipped=true, note_override_by='$TUTOR' WHERE id='$L4';"
pass "note skip once per case; admin override allowed"

psql_q -c "INSERT INTO public.case_lessons (case_id, sequence, tutor_id, starts_at) VALUES ('$MCASE', 5, '$TUTOR', now() + interval '20 days');" >/dev/null
set +e
NOCRED=$(psql_q -c "INSERT INTO public.case_lessons (case_id, sequence, tutor_id, starts_at) VALUES ('$MCASE', 6, '$TUTOR', now() + interval '21 days');" 2>&1)
set -e
echo "$NOCRED" | grep -q INSUFFICIENT_CREDITS || fail "booking without credits allowed: $NOCRED"
pass "no credits -> managed booking refused (no negative balance)"

PURE=$(psql_q -c "INSERT INTO public.tutoring_cases DEFAULT VALUES RETURNING id;" | head -1)
BEFORE=$(psql_q -c "SELECT count(*) FROM public.credit_ledger_entries;")
PL=$(psql_q -c "INSERT INTO public.case_lessons (case_id, sequence, tutor_id, starts_at) VALUES ('$PURE', 1, '$TUTOR', now() + interval '30 days') RETURNING id;" | head -1)
psql_q -c "UPDATE public.case_lessons SET status='done', attendance='present' WHERE id='$PL';"
AFTER=$(psql_q -c "SELECT count(*) FROM public.credit_ledger_entries;")
[ "$BEFORE" = "$AFTER" ] || fail "pure-matching lesson touched the ledger"
pass "pure-matching case never touches the ledger"

INV2=$(psql_q -c "SELECT bool_and(a.balance = s.amt AND a.held = s.hd) FROM public.credit_accounts a
  JOIN (SELECT account_id, sum(amount) amt, sum(held_delta) hd FROM public.credit_ledger_entries GROUP BY 1) s
  ON s.account_id = a.id;")
[ "$INV2" = "t" ] || fail "sum(entries) != balance after #533 flows"
pass "ledger invariant holds after attendance flows"

echo "All #532/#534/#533 SQL acceptance checks passed."
