# Open-issue audit — 2026-11-25

A verification pass, not a status meeting. For each open V1 ticket: read the
ticket, grep the code on `main`, run the checks, then record what is genuinely
left. The rule stays the repo's own: **a comment claiming an issue is done is
not evidence; the code on `main` is.**

This supersedes `issue-audit-2026-11-24.md`, whose "remaining" rows were already
stale by the next morning. Several items it listed as open had shipped:
`#737` ops visibility and the 180-day prior-contact window, `#756`'s dispute
carve-out (`applyFeeGate` / `openTutorDisputes`), `#726` likes, `#751` web
prefill, `#740` heatmap invalidation, `#794` Community Champion and the Impact
desk panel, `#783` cookie consent and BYOS.

## Bug: a test that had been running zero tests

`tests/cases/sched-828.test.ts` imported through the `@/` alias. Vitest in this
repo does not resolve that alias — every other test file uses a relative path —
so the file failed to load and its 4 assertions never ran. It was the only test
file using the alias. Fixed.

## Bug: the public hours counter ignored a confirmation

`#459` wrote every done lesson into `verified_hours_ledger` as
`pending_confirmation` and let a 24h sweep verify it, so a tutor whose parent
had already confirmed still had no public hours. The trigger now credits
`verified_completed` / `verified_by = 'auto'` when both confirmations are
already stamped, and promotes the pending row when the second lands later.
Disputed rows are never overwritten; cancelled rows are never resurrected.
Verified live in rolled-back transactions (both-first, one-then-two, disputed,
leaving done) and read back from `pg_proc` / `pg_get_triggerdef`.

## Bug: a seller breakdown that rendered nothing

`#784` `AC-784-FORM-1/2` were gated on `NOTES_OPTION_A_LIVE`, the same constant
that turns on Stripe checkout, so the payout split was invisible to sellers.
A display-only `SHOW_EARNINGS_BREAKDOWN` renders it now. `NOTES_OPTION_A_LIVE`
stays `false` and still gates every payment path.

## Bug: legal copy contradicting the fee lock

`/guide/partners` meta description advertised a "performance-based introduction
fee" while the page body (and the fee lock) say the centre pays HK$0 and the
independent tutor pays the 1.5-lesson admin fee. Meta corrected.

## Per-ticket state

| Ticket | State |
| --- | --- |
| **#712** | AC-1, AC-3, AC-4 shipped and verified. AC-2 (partner centre profile with stealth `noindex` and ≤5 featured courses) is the only one left and is blocked by `CENTRE_MARKET_ENABLED = false` (owner decision 2026-11-23). It also overlaps #815, which owns the thin partner channel. Owner call: move AC-2 to #815 and close #712. |
| **#783** | §2.2 cookie consent, §2.4 BYOS carve-out (invite, 7-day TTL, 180-day prior-contact window, HK$0 ledger skip), §2.5 phones-after-fee all shipped. §2.3: the 7-day cap, the opt-in default and one-click unsubscribe ship; the promo email itself does not exist, so `AC-717-2` (same-subject suppression) has no sender to enforce it on. §2.1 stays gated on the Stripe cutover, same as #784 §2.1/2.3. |
| **#784** | `AC-784-FORM-1/2` pass now. §2.2 payouts (Monday FPS batch, two-person approval, sales ledger) shipped. §2.1 Stripe Checkout and §2.3 the coordinated switch stay blocked on the owner's cutover. |
| **#794** | Wave 1 complete: ratings micro-flow with the 14-day windows and private desk report, Community Champion badge (trigger-awarded, not self-claimable), `/impact` still held, Verified Need upload + desk queue + PDPO purge, Impact desk seat/shop grants, progress evidence. §2.5 social posts and §2.6 (now shipped) are the ticket's own later slices. |
| **#797** | Wave 1 shipped: Concierge refer button on the tutor profile and the connections hub, "messaging is coming" copy retired, no thread tables or routes exist to leak. §2.1–2.3 are desk process (Master Sheet, Gemini Gems, script pack in `docs/desk-whatsapp-script-pack.md`), not repo code. |
| **#798** | Every AC implemented and unit-tested (41 tests across `tests/tutor-application`). One AC needs a device: the WhatsApp iOS in-app resume round trip. Cannot be run locally because `.env.local` has no Supabase server vars, so DB-backed SSR 500s. |
| **#815** | Centre stack. `CENTRE_MARKET_ENABLED = false` keeps the public surface dark; the remaining work is data and live verification, per the ticket's own header. |
| **#616 / #618 / #619** | Parked by the 2026-11-24 lock. Do not build. |
| **#736** | Parked as stretch by its own lock; #794 forbids unparking it. |

## What is actually left

1. **Owner decisions, not code:** the Stripe cutover (#783 §2.1, #784 §2.1/2.3)
   and the #717 promo email that would activate the capped-suppression guard.
2. **One device pass:** #798 AC-4.
3. **One flag:** the centre channel (#712 AC-2 / #815), held dark on purpose.
4. **Parked by their own locks:** #616/#618/#619, #736, #794 §2.5.

There is no large unbuilt V1 slice hiding behind these tickets. The next real
feature work is in the "later" tickets (#824 locale audit, #825 recommendations,
#828 scheduling), not in V1.
