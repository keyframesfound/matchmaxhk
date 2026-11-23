# Option A / V1 live QA checklist (#783, #797, #784)

Code-side is verified. These are the steps that need a real signed-in session.
Each item lists **preconditions → steps → expected → evidence to paste back**.

Record evidence as a screenshot or the row you read back (SQL is fine).

---

## 1. BYOS invite end-to-end ( #783 §2.4 / was #737 )

**Preconditions:** a tutor account, and a second account that has **never** inquired about or matched with that tutor.

1. As the tutor, open the BYOS invite card and create one: label, subject, level, hourly rate, mode.
2. Copy the link (`/invite/...`, built by `byosInvitePath`).
3. Open it signed out: expect the invite preview (subject, level, rate, mode), not a 404.
4. Claim it as the never-inquired account.
5. Read the case row:

```sql
select case_source, admin_fee_waived, status from public.tutoring_cases where id = '<claimed case id>';
```

**Expected:** `case_source = BYOS_DIRECT`, `admin_fee_waived = true`, and no admin-fee invoice is created for it (`case_fees` has no payable row).

**Anti-circumvention:** repeat with an account that **already** inquired about this tutor. Expected: the claim is refused (`byosClaimRefusal`), no waived case is created, and the normal fee path still applies.

---

## 2. Seven-day promo cap, with a real send ( #783 §2.3 )

**Preconditions:** an account opted in to automated mail, with a real address.

1. Send the weekly digest twice in a row for the same account (staff send action, or the Sunday 20:00 HKT sweep).
2. Expect the second send to be refused by the 7-day slot.
3. Send a transactional mail (receipt / fee reminder) to the same account.

**Expected:** the second digest does not arrive; the transactional mail still does inside the same window.

**Also check:** the footer unsubscribe link opens and one-click unsubscribe flips the opt-out.

---

## 3. Cookie banner, first visit ( #783 )

1. Fresh private window, no cookies. Open `https://matchmax.hk/en`.
2. Confirm the banner shows before any non-essential script runs (Network tab: nothing analytics-shaped before consent).
3. Accept, reload: the banner does not reappear.
4. Repeat and reject: the choice persists and nothing non-essential loads.

---

## 4. Pre-match risk holds ( #783 §2.6 item 8, shipped #838 )

1. As a parent, submit a request whose notes say `hotel room, 11pm`, University, tutor gender female.
2. Read:

```sql
select status, compliance_triage from public.tutoring_cases order by created_at desc limit 1;
```

**Expected:** `status = compliance_hold` and `compliance_triage.prematchRisk` lists both `venue_industrial_or_hotel` and `late_night_adult_specific_gender`.

3. Submit a clean child request (Primary, at home, 4pm). Expected: normal triage status, no prematchRisk.

---

## 5. Weekly payout preview ( #784 §2.2, read-only )

1. As staff, open `/admin/materials`.
2. Read the "Weekly FPS payout run (preview)" card.

**Expected:** seller count, total due, under-minimum count, missing-details count; each row shows balance, due and method. **Export batch CSV** contains only sellers with a due amount.

**Do not** press "Run Monday batch" in production. A real run moves money; it belongs on a test seller in a non-production project.

---

## 6. Error pipeline ( #843 )

1. Force a client failure (throttle the network, or navigate with a broken param).
2. Read:

```sql
select created_at, source, occurrences, left(message, 120), left(url, 40) from public.error_logs order by created_at desc limit 5;
```

**Expected:** a row within seconds with the real message and a non-empty stack. Repeating the same failure increments `occurrences` rather than adding rows.

---

## Blocked on the flag flip

Do these only after `NOTES_OPTION_A_LIVE` is on in the target environment: AC-559-1 copy purge and AC-544-2.

## Recording results

Per item, paste the step that passed or failed, the SQL output (or screenshot) and the timestamp. Anything red becomes a bug report with the row attached.