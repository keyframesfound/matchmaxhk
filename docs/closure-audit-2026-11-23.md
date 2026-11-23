# Closure audit ledger, 2026-11-23

Audited six umbrella issues (#782, #783, #784, #794, #797, #798) against
`origin/main` at `468287ba`. Method: every prose requirement in the issue body
was checked against code, migrations, locale files, and docs on main, with
`path:line` evidence. Anything that requires a running deployment, a live
Stripe/WhatsApp/Supabase round trip, or seeded production data is marked
**UNVERIFIED** and is not counted as done.

Verdicts below are SAFE only when every AC has code evidence or a recorded live check. None of the six is SAFE today.

## #782 Safety attestation and contraband screening

**Verdict: NOT SAFE.**

- **Closed 2026-11-23:** the tutor publish path is now gated. A DB trigger
  (`trg_tutor_publish_attestation`) requires the Safety Attestation on any
  false→true `is_published` update; staff and service-role restores are exempt.
  The submit fns already gated apply/accept/upload.
- **Corrected 2026-11-23 (the earlier finding was stale):** profile-bio
  contraband screening is NOT client-side only. `public.contraband_category()`
  is a SQL mirror of the TS ruleset and `trg_tutors_contraband_guard`
  (BEFORE INSERT OR UPDATE on `public.tutors`) walks every string/array/object
  column and raises `P0001` on a hit. Verified live: "I sell weed, DM me" in
  `self_introduction` → blocked; a clean bio → allowed; probe row deleted.
- **Corrected 2026-11-23:** the quarantine counter is not a defect.
  `reports.functions.ts` rejects self-reports and enforces an hourly open-report
  cap before insert, so `distinct reporter_id` rows are authentic by
  construction.

**Needed:** nothing known on 2.1 and 2.3; the remaining ACs (SCRC, quarantine,
Emergency Suspend, §2.5) are under a per-AC evidence pass.

## #783 Option A cutover readiness

**Verdict: NOT SAFE.**

- Live QA not done (UNVERIFIED): BYOS claim, #760 ledger, cookie banner first
  visit, 7-day promo cap with real sends.
- §2.6 items 8 (industrial/hotel risk hold) and 10 (1-vs-2-student toggle,
  address autocomplete) not located in code.
- Post-cutover ACs (AC-559-1 copy purge, AC-544-2) cannot be satisfied while
  `NOTES_OPTION_A_LIVE=false`.
- **Closed 2026-11-23:** `splitRefundMoney` now takes the order's
  `platform_fee_pct` (2% Option A, 20% cashier, safe fallback), so partial
  refunds price correctly after the flip.

**Needed:** live QA (owner/staff), owner decision on the two unlocated §2.6 items.

## #784 Notes marketplace payout and states

**Verdict: NOT SAFE.**

- No weekly Monday FPS payout batch exists. Only a manual CSV export
  (`src/features/materials/orders.functions.ts:521`) and a ledger insert
  (`src/features/materials/checkout-v2.functions.ts:36,60`). `seller_balance_entries`
  has 0 payout rows (UNVERIFIED against live DB).
- AC-543-6 seller sold / window-closed copy exists in locales
  (`src/features/i18n/locales/en.json:4451-4452`) but is never referenced by any
  component, so it never renders.
- AC-FORM-1/2 calculator is gated behind `NOTES_OPTION_A_LIVE`
  (`src/features/materials/note-editor-form.tsx:2028`), so it is not visible in
  production. Prior tick was wrong.
- Stripe webhook was non-atomic: it delegates to `handleStripeEvent` with no
  transaction (`src/routes/api/stripe/webhook.ts:1-51`). Fix in flight.
- Option A guide copy now says weekly (`en.json:4420,4434-4435`); the older
  `docs/notes-marketplace-guide.md:13` still says monthly.

**Needed:** code (atomic webhook, render the two states), owner decision on
whether the batch is in scope, live DB check on payout rows.

## #794 Case Manager evidence and channels

**Verdict: NOT SAFE.**

- §2.5 Social Channel Posts and §2.6 Student Progress Evidence are unbuilt inside
  this ticket.
- Household cascade control is absent; an account-level pass substitutes
  (`src/features/cases/admin/NeedVerificationQueue.tsx:63`).
- Six manual smoke items unverified (no seeded case).

**Needed:** code (two sections, cascade control), live QA on seeded case.

## #797 Wave 1 verification debt

**Verdict: NOT SAFE (code complete, verification debt).**

- AC-512-1/2/3 and AC-513/514 live only in Business WhatsApp and the Master
  Sheet, unverifiable from the repo.
- AC-618-3 over-claimed: there is no stale-thread redirect, only the root 404,
  and no thread routes or tables exist, so the condition is vacuous
  (`ls src/routes | grep thread` is empty).

**Needed:** owner/staff evidence for the WhatsApp items; build the redirect or reword AC-618-3.

## #798 Optional listing chips and availability timezone

**Verdict: NOT SAFE.**

- Optional style/fit/syllabus `#tag` rows were never built; the ticket says the
  values are not locked, so they cannot be.
- AC-9 "availability interpreted in tutor timezone" is unbuilt: storage and
  display are HKT/UTC+8 (`src/features/tutors/availability-grid-model.ts:86`,
  `availability-filter.ts:100-101`), and the UI discloses HKT.
- Draft-saved indicator is missing and the signed-in profile edit has no
  autosave (`my-tutor-profile-section.tsx` save path is manual only).

**Needed:** owner decision on chip values; code for AC-9 and autosave.

## Next candidates, ordered by effort

1. #784 webhook recovery and cadence copy (shipping).
2. #784 seller sold / window-closed states (copy already exists).
3. #782 publish-path attestation and bio server screening.
4. #798 optional chips (needs locked values first).
5. #784 weekly Monday FPS payout batch.
6. #815 §2.11 overflow lane.

## How to re-run this audit

Prompt shape used: "Audit umbrella issue #N against origin/main. For every prose
requirement in the body, find path:line evidence or mark UNVERIFIED. Return
verdict SAFE / NOT SAFE, the exact open items, and who owns each (owner decision,
code, live QA). Do not invent statuses; do not close the issue."
