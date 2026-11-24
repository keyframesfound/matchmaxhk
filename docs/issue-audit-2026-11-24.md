# Open-issue audit — 2026-11-24

Every open V1 ticket in the 700–760 range was read against `main` by a
read-only pass: pull the ticket body, extract its acceptance criteria, then
grep/read the code for each one. The rule was the repo's own: **a comment
claiming an issue is done is not evidence; the code on `main` is.**

Why this matters: #768 was once re-implemented from scratch because a stale
branch predated 259 commits of shipped work, and most of the tickets below were
80% built while still reading as open. This ledger records what actually ships
so nobody rebuilds it.

## Closed during the audit (evidence posted on each issue)

| Issue | Verdict basis |
| --- | --- |
| #723 Rename nav to "Join MatchMax" | `nav.become_tutor` = "Join MatchMax" in en/zh-HK/zh-CN; fixed the one stale instruction that still named the old label |
| #727 Remove the slot badge | No numeric badge on cards or profile; dead producer (`getTutorAvailabilityBadge`) and its two keys removed so it cannot return |
| #728 Scroll-to-top overlaps currency | Float already excluded on `/me` (`BackToTopButton.tsx:38`) |
| #729 Airbnb-style press feedback | `#729` press tokens in `button.tsx:10,53` + `.mm-press` in `styles.css:844` |
| #731 "Request this tutor" on notes | Upsell card + prefill wired at `notes.$slug.tsx:524`, tests in `note-tutor-upsell.test.ts` |

## Bugs the audit found (fixed, not filed)

| Bug | Fix |
| --- | --- |
| #756 the parent's browser received the MatchMax admin fee (amounts + settlement state) in the payload and showed it | server read gated by role (#859); panel is tutor-only |
| #746 the super drawer promised "Tutor-only — never shown to parents" while the feed rendered those tags to the parent | copy corrected + key renamed `pulse_private` → `pulse_audience` (#860) |
| #741 Revision Mode hid the solution but rendered the tutor tip — where the method lives | tip gated through the tested `solutionVisible` predicate (#861) |
| #737 a leaked BYOS link granted a HK$0-fee case forever | 7-day `expires_at` + refusal reason + honest landing copy (#862) |
| #756 the FPS screenshot label said 5 MB while the code enforces 10 MB | copy fixed (#859) |

## Still open, with what is actually left

### One small fix away

| Issue | Remaining work |
| --- | --- |
| #751 prefill from search filters | WhatsApp path is done (`buildWhatsAppPrefill` + tests). The **web** path is not: `/case-request` accepts only `tutor`/`req_curriculum`/`req_subject`/`req_time`, so mode never carries into the form, and the profile CTA at `tutors.$tutorCode.tsx:1013` sends no params |
| #740 mastery bar goes stale | Saving mastery in the Super Drawer invalidates `["sor","tutor-cases"]` but not the heatmap query, so the % bar does not refresh (`super-drawer.tsx:178`) |
| #737 BYOS ops visibility | No admin badge for a waived case (`admin/shared.ts:208` omits `case_source`/`admin_fee_waived`), and the prior-contact rule has no 180-day window — it blocks forever |
| #756 dispute carve-out | The 72h gate blocks new applications with no "unless a #260 dispute is open" exemption (`fee-desk.ts:69`) |
| #726 like notifications | "Save" is notified end to end; **like** does not exist in schema or code at all |
| #725 notes vertical | Save-search + matcher only cover tutors and cases; `tickSavedSearchAlerts` returns `[]` for notes |

### Real remaining build

| Issue | Shape |
| --- | --- |
| #724 unified search | Core cards are not accordions (no single-expand), the closed mobile bar is still two lines, no Recents list, no `[≡]` secondary-filters entry |
| #732 sign-in at the end | Tutor and Centre already do guest-fill + `pending-submit` envelope; the **Notes** path is still behind `_authenticated` with no draft store |
| #749 progressive reveal | No stage computation at all; the parent case page is one flat stack, and the drawer has 5 tabs, not the 4 consolidated ones |
| #745 3-tap personalizer | Nothing on `/tutors`; goals live inside a case drawer and only prefill a new case |
| #744 tag bridge | Weak-topic surfacing ships; no `linked_material_id` on homework, no #tag filter on the marketplace |
| #742 weekly digest | Card + copy-WhatsApp ship; it is not on the dashboard, the recap is one free-text field not the 4-part structure, and the PDF omits gradebook scores |
| #741 mistake book | Create/reveal/mastered/RLS all ship; missing filters (topic/error cause/status) |
| #739 storefront cards | No enrolled count / total hours / rewatch badge / strike-through price; no `/library` player, no module completion, no Q&A |
| #738 course publisher | No module duration or free-preview toggle, so no auto totals; HK$0 courses queue for a cashier instead of self-enrolling |
| #736 gradebook | Homework has no score column, so nothing can auto-populate; chart is single-series with no verified-hours axis; no admin progress view |
| #735 case workspace | Prep note/prep surface exists only in the `/calendar` drawer; no homework score, no 10 MB attachment on a homework row |
| #734 lesson log | Pulse tags ship and persist; no 250-char weaknesses note, no cumulative engagement counter, pulse is one jsonb not indexed columns |
| #733 usefulness pulse | Ships as a 3-verdict card at milestones 5/10/15, not a 1–5 score on every lesson with a 200-char note |
| #730 outcome evidence | Only groundwork: `progress-evidence.ts` + tests, zero consumers, no table, no form, no profile surface |
| #717 recommendation email | Opt-in flag + unsubscribe + 7-day cap exist; no email template, no cron, no 3-tutor builder |
| #716 suggested row | Ships on the landing page with reason pills and active-match exclusion; not on the dashboard |
| #756 settlement card | Fee state machine, FPS upload, ops approve all ship; the card is the lean fee-desk panel, not the 1.5-lesson wireframe, and Stripe is absent |

## What this changes about sequencing

The tracker overstates how much is left. Of ~28 audited V1 tickets, **none
needed rebuilding** and five were closeable outright. The cheap wins are the
six "one small fix" rows; the expensive ones are #724 (search), #749 (stage
gate), #739/#738 (course player) and #736 (gradebook scoring), each of which
needs a schema change plus a new surface.