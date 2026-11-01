# Notes shop: dispute, report and refund standard (SOP)

Status: **locked by #573** (Notes Marketplace Master SoT, 2026-11-01).
Consolidates #573 with #543 (checkout + 72h hold), #556 (marking
dual-timer, ratings), #559 (rubric, strikes) and #544 (public copy). The
former proposed items are now signed off (see §8). Rule of precedence:
**Hauzton's latest update wins** (today #573), then #543 / #556 / #559 /
#544. If this document disagrees, it is wrong and must be updated.

Code: the numbers and money rules live in
`src/features/materials/marketplace-policy.ts` (unit-tested); staff tools
should call it instead of re-deriving amounts.

Scope: digital materials (`notes`, `mock`, `exemplar`, `flashcards`,
`course_bundle`) and marking services (`marking_service`). Tutoring
lessons (#558) are out of scope until that pilot is unparked.

---

## 0. Hard locks (never overridden by staff judgement)

| Lock | Rule | Source |
| --- | --- | --- |
| Golden financial rule | Refunds only from **held** funds: `paid_held`, `delivered_held`, `disputed_frozen`. Never after `completed_released`. MatchMax never pays a refund out of pocket. | #559 §A |
| Digital files clock | Hold = `paid_at + 72h`. Disputes only while `now() < hold_expires_at`. | #543 |
| Marking clock | Seller must deliver before `seller_due_at`; buyer inspection hold = `delivered_at + 72h`. | #556 |
| Fees (Option A) | Buyer pays exactly the listed price. Seller net = gross - 2% platform fee - actual gateway fee (Stripe `balance_transaction.fee`). 2% is the launch rate (first 6 months or HK$50,000 GMV, then review with 30 days' notice). | #573 |
| Seller-fault refund | Buyer gets 100%. The gateway fee Stripe keeps (and any chargeback fee) is booked as a **negative balance offset** on the seller, deducted from current or future payouts. | #573 |
| No cooling-off | D10 removed. No refund for accidental purchase or change of mind, downloaded or not. | #573 |
| Price floor | Free (HK$0) or HK$20 to HK$5,000 (marking ≥ HK$50). | #573, #556 |
| Payouts | Monthly, once the released balance is ≥ HK$50 (or in full on account closure). FPS / PayMe / AlipayHK. | #573 |
| Manager gate | Any single refund or payout adjustment ≥ HK$500 needs Operations Manager sign-off. | #573 |
| No quality arbitration | Staff never judge teaching style, usefulness, neatness or grade outcomes. | #559 |
| Ghostwriting | Zero tolerance, both sides. | #556, #559 |

---

## 1. Two channels, never mixed

| | **Dispute** ("Report a problem / Request refund") | **Report** ("Report listing / review / profile") |
| --- | --- | --- |
| Who | The buyer of that order only | Anyone signed in (buyers, sellers, visitors with an account) |
| About | One **order**: money | A **listing, review, profile or message**: content and conduct |
| When | Only inside the hold window | Any time |
| Effect | Order → `disputed_frozen`, auto-release paused | Ticket in the reports queue; no money moves by itself |
| Can refund? | Yes, from held funds, per §3 | Only indirectly: an upheld report on contraband refunds that listing's **still-held** orders (§5.4) |
| Where in code | `material_disputes` (#543) | `reports` (`ReportMenuButton`, `REPORT_REASONS`) |

A buyer who wants money back must use the dispute flow. A report from a
buyer about their own order is redirected to the dispute flow if the
window is still open; if it is closed, it is handled as a report only (no
refund).

---

## 2. What counts as eligible for a refund

### 2.1 Digital materials (window: 72h from `paid_at`)

| # | Claim | Eligible? | Objective test staff apply | Refund |
| --- | --- | --- | --- | --- |
| D1 | File missing / cannot be downloaded | Yes, if logs show **no** successful download, or the stored master file is missing | `material_download_logs` + "Inspect master file" | 100% to buyer |
| D2 | File corrupt, blank, password-locked, unreadable | Yes | Staff open the **master** file; buyer screenshot required if logs show a download | 100% to buyer |
| D3 | Wrong subject / curriculum / level | Yes | Master file vs listing title, curriculum, subject, category, summary | 100% to buyer |
| D4 | Far shorter than listed | Yes, only if **< 50%** of the stated page count (or word count / item count) | Count pages in master file | 100% to buyer |
| D5 | Preview pages not in the file (bait and switch) | Yes | Every seller-picked preview page must exist in the master file | 100% to buyer |
| D6 | External / cloud link dead or restricted | Yes, if not fixed within **48h** of the dispute | Staff open the link in a private window | 100% to buyer |
| D7 | A listed extra file (Word / PPT / ZIP / video) or link from "What's included" is missing or corrupt, main file is fine | Yes, if not fixed within 48h | Open each item listed under "What's included" | **100% by default.** Partial only if the buyer accepts the offer within **24h** |
| D8 | Contains banned content (official past papers, another student's work, contact QR codes) | Yes | §5 checklist | 100% to buyer + strike |
| D9 | Duplicate purchase of the same item by mistake | Yes | Two paid orders, same buyer, same listing | Second order refunded **minus gateway fee** |
| - | Single accidental purchase / changed mind, downloaded **or not** (former D10, removed by #573) | **No** | | |
| - | "Not useful", style, handwriting, formatting, "too basic" | **No** (preview shown before purchase) | | |
| - | Didn't get the grade / level | **No** | | |
| - | Outdated syllabus | **No**, unless the listing explicitly states a syllabus year or session the file contradicts (then D3) | | |
| - | Found it cheaper or free elsewhere | **No** | | |
| - | HK$0 free item | No refund (nothing paid); content problems go through **Report** | | |

**Who pays the gateway fee (Option A):** D1-D8 → buyer refunded 100%, the
fee becomes a seller negative-balance offset (`refunded_full`). D9 →
buyer refunded gross minus the fee, no seller offset (`refunded_less_fees`).

### 2.2 Marking services (#556 dual timer)

| # | Claim | Eligible? | Refund |
| --- | --- | --- | --- |
| M1 | Seller missed `seller_due_at` | Yes, **automatic** | 100% to buyer (seller offset) |
| M2 | Delivered file won't open, or has zero annotations / comments | Yes (within 72h of delivery) | 100% to buyer (seller offset) |
| M3 | Seller marked the wrong document or ignored the stated scope entirely | Yes | 100% to buyer (seller offset) |
| M4 | Buyer cancels **before** the seller downloads the draft | Yes | Price **minus gateway fee** |
| M5 | Cancel after marking began | No | |
| M6 | Disagrees with predicted grade or strictness | No | |
| M7 | Buyer asked for ghostwriting | No refund; buyer permanent ban (§5) | |

### 2.3 Partial refunds

Default is **all or nothing**: every eligible row above is a full refund.
A partial refund is allowed only when (a) the seller is at fault on part
of a multi-item listing (D7) **and** (b) the buyer accepts the partial
amount in the dispute thread within 24 hours (otherwise the full refund
goes ahead). Staff record the agreement in
`resolution_note`. Partial refunds still come only from held funds.

---

## 3. Dispute procedure (staff)

### 3.1 Intake (buyer side, automatic)

1. Buyer opens "Report a problem" on the order (button visible only inside the window).
2. Buyer picks a reason code **D1-D9** (the only new values `material_disputes.reason` accepts after the #573 migration) and writes at least 10 characters. D9 is offered only if the system finds another paid order by the same buyer for the same listing.
3. **Evidence required:** a screenshot or screen recording for D2 / M2 claims when the logs show a download; page references for D3-D5.
4. Order → `disputed_frozen`; auto-release paused; hold clock stops.
5. Seller notified: "A buyer reported a problem. Reply or fix within 48 hours."
6. Buyer sees the warning copy from #543 (false claims may suspend the account).

### 3.2 Timeline

| Step | Deadline |
| --- | --- |
| Seller response / fix (re-upload, restore link) | **48h** after the dispute opens |
| Staff first look (triage, P1 contraband check) | **1 business day** after the dispute opens |
| Staff decision | **2 working days** after the seller responds or the 48h passes |
| Operations Manager sign-off | Any single refund or payout adjustment **≥ HK$500** (`requires_manager_approval` is set automatically) |
| Escalation to ops lead (Tim / Austin) | Any case staff cannot settle with the rubric, any fraud or ban decision |

The hold stays frozen until the decision, however long it takes; no
auto-release ever happens on a frozen order.

### 3.3 The 3-point rubric (in order, stop at the first decisive result)

1. **Logs.** Did the buyer download (≥1 row in `material_download_logs`), or did the seller miss `seller_due_at`?
   - "Never received" + logs show a download + no screenshot → **reject** (buyer strike if clearly false, see §5).
   - Seller missed deadline → **refund** (M1).
2. **Master file vs listing.** Open the stored master (never the buyer's copy). Does it open, and do subject, curriculum, level, page count, seller-picked preview pages and the "What's included" items match the listing?
   - Matches → **reject and release to seller.** Do not read for quality.
   - Fails an objective row in §2 → **refund**.
3. **Prohibitions.** Banned content, contact harvesting, another student's work?
   - Yes → **refund + unpublish + strike** (§5), regardless of step 2.

### 3.4 Outcomes

| Outcome | Order status | Money | Listing | Strike |
| --- | --- | --- | --- | --- |
| Rejected | `completed_released` (released to seller, #543) | to seller | unchanged | buyer strike only for a false claim (§5 cat. 5) |
| Seller fixed it within 48h and buyer confirms (or doesn't reply in 48h) | released | to seller | unchanged | none |
| Refund, seller fault (D1-D8, M1-M3) | `refunded_full` | buyer 100%; gateway fee booked as seller offset | seller asked to fix; unpublish if the master is bad | warning; 1 strike if intentional deception or ignored for 48h (D6/D7) |
| Refund, duplicate (D9) / M4 | `refunded_less_fees` | gross minus gateway fee | unchanged | none |

### 3.5 Communication

Every decision sends both sides a short message (templates in §7) stating
the outcome, the rule applied (row ID such as "D4"), and that the decision
is final unless new evidence arrives within 48h. Staff never reveal buyer
or seller contact details to the other side.

### 3.6 Appeals

One appeal per dispute, within 48h of the decision, only with **new**
evidence. Decided by a different staff member or the ops lead. No appeal
can create a refund after funds were released.

---

## 4. Report procedure (staff)

### 4.1 Report reasons (existing `REPORT_REASONS`) and priority

| Priority | Reasons | Interim action on receipt | Decision within |
| --- | --- | --- | --- |
| **P1** | `copyright` (official past papers, textbooks, school papers), ghostwriting offers, contact harvesting (`contact_details`), suspected fake / decoy file, `impersonation` | Staff may **hide the listing immediately**; auto-hide once a listing has **3 open P1 reports**; freeze held funds on its active orders | **24h** |
| **P2** | `not_as_described`, `fake_credentials`, fake or shill reviews, `harassment`, `inappropriate_image` | none | **3 business days** |
| **P3** | `spam`, `other` | none | **5 business days** |

The reporter's identity is never shown to the reported user. The existing
limit (5 open reports per account per hour) stands.

### 4.2 Steps

1. Triage: set priority; for P1 hide the listing if the evidence is plausible.
2. Verify against the master file, listing text, preview pages and extras.
3. Decide: **Dismiss** / **Ask seller to fix** (edit within 72h, e.g. remove a QR code) / **Unpublish** / **Strike or ban** per §5.
4. Record the decision and rule in the report row; notify the reporter ("we reviewed your report and took action" or "no breach found"), without naming the penalty.
5. If unpublished for contraband: run §5.4 on that listing's orders.

### 4.3 Reviews

- Only buyers with access can post (enforced in code by `orderGrantsNoteAccess` in `src/features/materials/note-reviews.ts`, shipped in PR #570; not on `main` until that merges).
- A seller may report a review for: contact details, harassment or vulgarity, content about a different product, or evidence of shill / secondary accounts.
- **A negative but honest review is never removed.** Staff never edit review text; they remove it or keep it.
- "Report review" is **locked in** (#573). Spam / harassment / off-topic reviews are P2 (3 working days). Engineering: add `material_review` as a report target type so the menu sits on each review.

### 4.4 Third-party IP takedown

A rights holder (publisher, school, exam board) uses the Report button or
emails legal@matchmax.hk (procedure published at `/copyright`).
Staff hide the listing within **24h** of a credible notice (identifies the
work and the listing), notify the seller, and allow a counter-notice within
7 days with proof of ownership. Category 1 strikes apply once confirmed.

---

## 5. Banned content and the strike ladder

One ladder for every category: the #573 three-strike policy (Notes
Marketplace Terms §4.2). Where the older #559 §D table differs (for
example a 30-day suspension for a second fee-avoidance offence), **#573
wins**: Hauzton's latest update is the source of truth.

| Strike | Penalty (#573 §4.2) |
| --- | --- |
| 1 | Remove the violating listing(s), refund every still-held order on them in full, written warning |
| 2 | Remove, **14-day** upload suspension, extended escrow holds on the seller's new sales |
| 3, or severe fraud / piracy | Immediate permanent removal of seller privileges; freeze pending escrow to cover buyer refunds and fee recoveries |

What counts as **severe** (straight to strike 3, no warning):

| Category | Example | Treatment |
| --- | --- | --- |
| Ghostwriting / contract cheating | Writing an IA / EE / SBA / TOK / personal statement for a student | Severe: permanent ban for the seller (and the buyer who commissioned it) |
| Bait and switch / blank file fraud | Decoy, blank or locked file sold to collect payouts | Severe: 100% refunds (gateway fee offset on the seller) + permanent ban + freeze held payouts |
| Bulk or repeat piracy | Systematic uploads of official HKEAA / IBO / CIE / Pearson papers or marking schemes | Severe at staff discretion; a one-off upload is strike 1 |

Other categories follow the ladder above: copyright / exam-authority
uploads, fee avoidance (contact details, QR codes, payment links),
harassment and fake or shill reviews (also remove the manipulated
ratings). **Buyers** who file false "corrupt / not received" claims after a
logged download get the same ladder on their buying privileges; any
unwarranted chargeback after a valid download is treated as severe
(permanent buying ban, download logs sent to Stripe as evidence).

5.1 `profiles.strike_count` (added by the #573 migration) is the marketplace
strike counter. It is **not** `tutor_trust_state.strike_count` (#537 fee-drop
trust), which counts something else. `profiles.strike_count` persists across suspensions and is always visible on
the staff user record.

5.2 Strikes are counted **per enforcement event**, not per file: a seller
who uploads five official past papers in one session gets **one** strike
(and all five listings removed). Severe P1 fraud or piracy can go straight
to a permanent ban (#573).

5.3 Strikes do not expire in V1.

5.4 **Contraband found on a live listing:** unpublish; every order on it
still in `paid_held` / `delivered_held` / `disputed_frozen` is refunded
100% to the buyer (gateway fee offset on the seller); released orders are not refunded (golden rule) but the
strike stands. A permanent ban freezes new listings and login immediately;
legitimate released payouts complete unless the fraud concerns those
specific orders.

---

## 6. Evidence and records

- Sources of truth: `material_download_logs` (every 15-minute signed URL),
  the stored master file, the listing snapshot (title, summary, page count,
  seller-picked preview pages, "What's included"), buyer screenshots, the
  dispute thread.
- Staff write the rule ID (D1-D9, M1-M7, category 1-6) in
  `resolution_note` for every decision, so outcomes are auditable and
  consistent.
- Retention (#573, privacy policy §12A): order, payout, fee and dispute
  ledgers **7 years** (IRO Cap. 112 s.51C); moderation logs, reports and
  removed listings **2 years** from resolution (PDPO Cap. 486), then purged.
- Weekly ops review: disputes opened / refunded / rejected, median time to
  decision, top rule IDs, repeat sellers and buyers.

---

## 7. Message templates (EN + 繁中)

**Refund approved (seller fault)**
EN: We reviewed your report and confirmed the problem (rule {ID}). A full refund of HK${amount} is on its way to your original payment method.
繁中：我們已審核你的申報，並確認問題屬實（規則 {ID}）。全數 HK${amount} 將退回至你原本的付款方式。

**Dispute rejected**
EN: We checked the download records and the original file. The file opens and matches the listing and preview (rule {ID}), so this order is not eligible for a refund. You can reply within 48 hours if you have new evidence.
繁中：我們已核對下載紀錄及原檔。檔案可正常開啟，並與商品資料及預覽相符（規則 {ID}），因此此訂單不符合退款資格。如有新證據，請於 48 小時內回覆。

**Seller asked to fix**
EN: A buyer reported a problem with "{title}" (rule {ID}). Please upload a working file or restore the link within 48 hours, or the order will be refunded.
繁中：有買家就「{title}」提出問題（規則 {ID}）。請於 48 小時內上載可用檔案或修復連結，否則訂單將會退款。

**Report outcome (to reporter)**
EN: Thanks for your report. We reviewed it and {took action / found no breach of our rules}.
繁中：謝謝你的舉報。我們已完成審核，並{已採取相應行動／未發現違規}。

---

## 8. Sign-offs (locked by #573, 2026-11-01)

1. D7 extras / links: 100% refund by default; partial only if the buyer accepts within 24h.
2. Staff decision SLA: 2 working days after the seller's reply or the 48h window.
3. Strikes: one per enforcement event, not per file; severe P1 fraud can be an immediate ban.
4. "Report review" stays; honest negative reviews are never deleted; abusive ones are P2.
5. Retention: 7 years financial, 2 years moderation. Manager gate: any refund or adjustment ≥ HK$500.
6. D10 (cooling-off courtesy) removed everywhere.

## 9. Quick-reference matrix (#573 Part 5)

| Code / queue | Scenario | SLA | Refund and fee rule (Option A) | Strike / account action |
| --- | --- | --- | --- | --- |
| D1-D5 | Missing, corrupt, wrong subject, < 50% pages, preview missing | 1 WD check; 2 WD decision | Buyer 100%; gateway fee debited from seller balance | Warning (1 strike if intentional deception) |
| D6-D7 | Broken link or missing bundle item | Seller 48h to fix; 2 WD decision | Buyer 100% (partial only if buyer agrees within 24h) | No strike if fixed in 48h; 1 strike if ignored |
| D8 | Prohibited / copyrighted content | Immediate freeze; 24h takedown | Buyer 100%; gateway fee debited from seller | 1 strike per event (ban if severe fraud) |
| D9 | Duplicate purchase | 1-2 WD | Duplicate refunded minus gateway fee | None |
| P1 report | Exam / school paper, contract cheating, contact info, fake file | 24h (auto-hide at 3 reports) | Freeze held funds on active orders | 1 strike per event |
| P2 report | Misleading description, fake / abusive review, harassment | 3 WD | N/A unless the buyer disputes | Remove review / require listing edit |
| P3 report | Formatting, categorisation, other | 5 WD | N/A | Advisory notice |
| Manager gate | Any single refund or adjustment ≥ HK$500 | Same SLA | Per D1-D9 | Ops Manager sign-off in admin |
