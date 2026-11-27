# Open-issue audit — 2026-11-27 (Asia/Hong_Kong)

A verification and build pass over the open V1-labelled tickets, run against
`main` at `d92540f2` plus the commits merged during the session. The rule is
unchanged: **the code on `main` is the authority, not the ticket text or a
comment claiming completion.**

Every row below has a command, a test name, or a `path:line` behind it.

## What landed on `main` before this pass

`d462c763 feat(marketplace): Option A goes live — 2% fee, card checkout, 72h hold`
merged at **14:50 HKT today**. That changed the answer for three tickets:

- **#784 §2.1 / §2.3** — Stripe Checkout is live, `NOTES_OPTION_A_LIVE = true`
  (`src/features/materials/marketplace-policy.ts:23`), and the seller breakdown
  derives from it, so `AC-784-FORM-1` / `-2` now render.
- **#783 §2.1** — the public 2% / 72-hour copy is the live contract, not a
  preview.
- **#783 §2.3 / #717** — the tutor-suggestion promo email merged (`#887`) but
  stays switched off until `app_settings.tutor_suggestion_emails_enabled` is
  true (owner call).

No code was needed for those three beyond removing one dead import; they are
now an ops-verification question (a real test-mode then live charge).

## What this pass changed

### #816 — staff desk (§2.1, §2.3, §2.7)

**§2.3 support ticket, the section that had no implementation at all.**
A ticket is a case artefact, not a chat product.

- Schema: `supabase/migrations/20261127140000_issue_816_case_support_tickets.sql`
  adds `case_support_tickets` and `case_support_ticket_messages`, a partial
  unique index enforcing **one open ticket per case**, five fixed reasons,
  `other` requires a 1–500 character note, and RLS-on/no-policy service-role
  access.
- Rules: `src/features/cases/support-tickets.ts` (`ticketInputError`,
  `replyError`, `canOpenTicket`, `isMissingRelation`). A staff reply that
  contains a phone, email, link or chat-app name is rejected through the shared
  `hasContactDetails` filter.
- Server: `src/features/cases/support-tickets.functions.ts`. The opener is the
  case's tutor or parent, a **parent of record even before a tutor is matched**,
  an **active member of the case's organisation** (centre contact), or desk
  staff. None of it writes `case_fees`, `fee_collected_*` or any fee table, so a
  no-show ticket cannot create the fee by itself.
- UI: `CaseSupportTicketsPanel` for the desk, mounted beside `MatchFeePanel` in
  `CaseDetailView.tsx:903`; `CaseSupportTicketCard` for the parties, mounted on
  the parent case page and in the tutor's lesson drawer, so a ticket can be
  opened without staff. Both render one quiet unavailable line before the
  migration instead of a 500.

**§2.7 explainable shortlist.** `match_tutors_for_case` already computed ten
score terms and returned only their sum.

- `20261127130000_issue_816_shortlist_why.sql` drops and recreates the RPC with
  the same authorization gate and the same #449 failed-tutor exclusion, and
  returns `why text[]` plus `factor_*` for every term. Tokens are stable and
  machine-readable: `subject, district, rate_full, rate_partial, mode, gender,
  background, language, experience, paid_fee, easy_desk`.
- The desk now requests Top 8, renders the Why chips, warns when fewer than five
  rows score ≥ 40, and can pin a tutor inside or outside the list. A pin writes
  `tutoring_cases.shortlist_pinned_tutor_id`, a `recommendation_used` funnel
  row with the rank position, and a `case_audit` row.
- The pin is read through a server fn, not the browser column select, so the
  admin case list still loads before the migration is applied; the pin controls
  hide themselves when the column is absent.

**§2.1 staff could not use the desk.** The `/admin/cases` route admits
`staff` (`_authenticated.admin.cases.tsx:136`), but every desk server fn only
accepted `admin`/`super_admin`, so a staff user saw the page and got
`FORBIDDEN` from each read and action.

- `desk-db.ts` now exports `requireDeskStaff` (staff / admin / super_admin)
  beside the unchanged `requireAdmin`.
- Desk reads and operations move to it (17 handlers in
  `admin-desk.functions.ts`, both wave-panel actions, CS backups, shortlist pin,
  support tickets). **Bulk status write, deletes, trust/suspend and payout
  approval stay admin-only.**
- `AC-55-3` case-id search: `case-filters.ts` now matches a pasted uuid
  (guarded to queries of 8+ characters so a one-letter query cannot match every
  id).
- `AC-816-DT-1`: the shortlist row already showed `tutor_level`,
  `guide_sent_at` and the L1 drop-off count. It now also carries the editor's
  actions inline: a one-click copy of the Tutor Service Guide URL, the
  guide-sent relative stamp, and a `Set REVIEW` button on any tutor at the
  drop-off threshold (the #782 risk-flag path). No desk field appears on a
  public surface (`AC-816-DT-2`).

**Two ACs closed after the first pass.**

- `AC-428-3`: a centre case no longer renders the ranked shortlist at all
  (the panel shows a manual-matching note); private and activity cases keep
  the Top-8. This matches the #825 manual-centre rule.
- `AC-262-3`: the Privacy page now carries the four #816 lines: staff see the
  case only to introduce and collect the fee, fee records are kept seven
  years, we do not sell the case list, and a delete request hides the profile
  while an unpaid or disputed fee is kept until the case is closed. EN plus
  the zh summary.

### #825 — the queue wrote to the wrong ledger

The panel recorded a queued backup as a `tutor_pinged` funnel row only. The
desk's wave panel reads `case_match_queue`, so a queued backup never appeared
there and was suggested again on the next pass.

- `queueCsBackupWave` now inserts into `case_match_queue` (rank continues after
  the existing max, score carried from the recommendation) and keeps the funnel
  row for reply/ghost tracking.
- A new `source` column (`20261127160000_issue_825_queue_source.sql`)
  distinguishes `engine` from `cs_backup`. **A desk-queued row is never
  auto-notified**, so the desk does not double-ping a tutor by WhatsApp and by
  automated alert; the panel labels it "Desk queued".
- If the case had no wave run, the queue action creates one **paused** with the
  current match fingerprint, so clicking "queue backups" cannot silently start
  automated waves. The desk can resume or notify from the wave panel.
- A run whose only pending rows are desk-queued now reaches `exhausted` instead
  of spinning `send_next` forever.
- Pre-migration, queue reads fall back to the legacy column list and map
  `source: "engine"`; queueing itself refuses with a clear
  `QUEUE_SOURCE_MIGRATION_REQUIRED` message rather than creating a row the
  engine might auto-send.

### #736 — gradebook and longitudinal graphs (streaks still parked)

- The Progress & Grades chart now draws **cumulative verified lesson hours** as
  background bars behind the score line, with a legend and an aria sentence that
  names the hours scale. Data comes from `verified_hours_ledger` rows with
  `status = 'verified_completed'`, bucketed by the HKT day they occurred.
- KPI cards add **Verified hours** and **Average score** beside the existing
  baseline / latest / progress cards.
- **Graded homework now reaches the gradebook.** `reviewHomework` accepts an
  optional 0–100 score (`20261127150000_issue_736_homework_score.sql`), the
  homework card shows it, and `getCaseProgress` merges reviewed + scored
  homework into the same score list and chart as `Homework` rows. The synthetic
  id cannot be deleted through `deleteAssessment` (uuid validation).
- **Admin inspection**: `StaffProgressPanel` (read-only, mounted on the case
  desk) shows the student graph, and a new **Tutor performance (12 weeks)**
  section shows weekly verified hours, homework reviewed rate and the rolling
  parent rating for the assigned tutor.
- Streak pills and freezes remain parked with #468 and were not built.

### Small live-surface fixes

- `business.$slug.tsx`: the Study Notes stat was hardcoded `0` while the
  materials list was already loaded; it now shows the real count. The Courses
  tab had no error branch; it now shows the bilingual `courses_error` line.
- `note-editor-form.tsx`: removed an unused `marketplaceTakeRate` import. The
  live 2% breakdown was never using the #672 tier helper, so the numbers were
  already correct; the import was just a trap for the next caller.

## Verified on `main` with no code change

- **#828** — `AC-C2` is superseded by the #793 lock: the phone pill row is
  Marketplace / Case / Join / Manage (`mobile-search-trigger.tsx:46-80`), and
  "Manage" is the locked label (`nav.tab_calendar` = Manage / 管理). `AC-C4`'s
  constants hold: `ACTIVE_STUDENT_WINDOW_DAYS = PRESENT_WINDOW_DAYS = 45`
  (`sor.ts:134`, `present-window.ts:7`), and no "parent pays admin fee" copy
  remains on the tutor calendar surfaces.
- **#784** — all Part 2 code is present; the only remaining questions are ops
  (test-mode charge, webhook secret, live flag).
- **#783** — cookie consent, BYOS carve-out, phones-after-fee, the #529 V1
  trust subset (flag vocabulary, WA classifier, risk holds, OTP), the 7-day
  promo cap with same-subject suppression and one-click unsubscribe, and the
  Stripe processor / download-log disclosure all exist.
- **#815** — the centre stack is code-complete behind
  `CENTRE_MARKET_ENABLED = false` (`src/lib/feature-flags.ts:1`); the owner
  decision of 27 Nov keeps it outside the V1 exit, so no dark feature work was
  started.

## Still open, and why

| Item | Why it is not code |
| --- | --- |
| #784 / #783 live-charge proof | Needs an ops run in Stripe test mode, then live keys |
| #717 promo email | Built and off; owner flips `tutor_suggestion_emails_enabled` |
| #815 centre channel | Owner keeps `CENTRE_MARKET_ENABLED = false` |
| #816 case refunds | Policy: "no parent refund, rematch is the remedy" (`fee-drop.ts:32`) |
| #816 two fee truths | Retiring the legacy fee panel is a product call |
| #816 phone-view audit row | Needs a product decision on what counts as a "view" |
| #816 macros duplicated | Four copies, no versioning; a refactor with no AC pressure |
| #825 AC-CS-7 403 | Non-staff are refused, but the transport surfaces a server error, not a 403 |
| #625 referral cash gate | Ticket carries `manual`; agents must not build it |
| #736 streaks | Parked with #468 |

## Migrations applied (live, 2026-11-27 23:55 HKT)

Applied to the linked Supabase project through the MCP, in this order, and read
back:

| Version | Name | Live evidence |
| --- | --- | --- |
| 20261127155545 | issue_816_shortlist_why | function returns 25 columns; called as an admin on CR-0005 and every row satisfies score = sum(factor_*); unauthenticated call raises forbidden; _limit default is 8 |
| 20261127155549 | issue_816_case_support_tickets | both tables, checks, partial unique index and grants read back; `other` without a note rejected (23514); a second open ticket rejected (23505); message insert ok; test row deleted, zero leftovers |
| 20261127155552 | issue_736_homework_score | case_homework.score_pct integer with the 0-100 check read back |
| 20261127155558 | issue_825_queue_source | case_match_queue.source text NOT NULL DEFAULT 'engine' with the engine/cs_backup check read back |

No production row was changed: the ticket test row was inserted and deleted in
the same call (its message cascaded), and the RPC was exercised read-only.

The code remains written to survive an environment where one of these is
missing, but on this project they are present now.

## Verification

```
npx tsc --noEmit                          exit 0
eslint --fix + eslint on all 41 changed
  .ts/.tsx files                          exit 0 (one pre-existing
                                          exhaustive-deps warning in
                                          note-editor-form.tsx)
npx vitest run                            234 files, 2655 tests passed
npm run check:i18n                        5602 keys in en / zh-HK / zh-CN
npm run build                             exit 0, Cloudflare module output
```

Live database checks (Supabase MCP):

```
list_migrations         4 new rows, no duplicates
RPC smoke (CR-0005)     5 rows, score === sum(factor_*) on all
support ticket checks   other-without-note 23514; second open 23505;
                        first open + message ok; test row removed
queue source            default 'engine'; bogus value rejected 23514;
                        test run/queue rolled back, zero leftovers
grants                  support tables: service_role only; function:
                        authenticated + service_role, PUBLIC revoked
```

New suites: `tests/cases/shortlist-816.test.ts` (10),
`tests/cases/support-tickets.test.ts` (19),
`tests/cases/tutor-performance.test.ts` (10),
`tests/cases/homework-score.test.ts` (11),
`tests/cases/cs-backups-queue.test.ts` (13),
`tests/cases/desk-roles.test.ts` (5).
