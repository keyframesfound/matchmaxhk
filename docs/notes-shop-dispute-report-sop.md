# Notes shop: dispute, report and refund standard (SOP)

Status: **draft for CEO / ops sign-off.** Consolidates the locked rules in
#543 (checkout + 72h hold), #556 (marking dual-timer, ratings), #559
(refund matrix, rubric, 3-strike) and #544 (public copy), and fills the
gaps those issues leave open. Items marked **[PROPOSED]** are new and need
a lock before staff apply them. Everything else restates a lock; if this
document and an issue disagree, **the issue wins** and this file is wrong.

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
| Fees | 2% platform fee + buyer-paid gateway fee. Seller fault → buyer gets 100% incl. gateway fee. Buyer-initiated / courtesy → gateway fee not refunded. | #543, #559 |
| Price floor | Paid ≥ HK$20 (marking ≥ HK$50); HK$0 free is the only exception. | #543, #556 |
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
| D1 | File missing / cannot be downloaded | Yes, if logs show **no** successful download, or the stored master file is missing | `material_download_logs` + "Inspect master file" | 100% incl. gateway |
| D2 | File corrupt, blank, password-locked, unreadable | Yes | Staff open the **master** file; buyer screenshot required if logs show a download | 100% incl. gateway |
| D3 | Wrong subject / curriculum / level | Yes | Master file vs listing title, curriculum, subject, category, summary | 100% incl. gateway |
| D4 | Far shorter than listed | Yes, only if **< 50%** of the stated page count (or word count / item count) | Count pages in master file | 100% incl. gateway |
| D5 | Preview pages not in the file (bait and switch) | Yes | Every seller-picked preview page must exist in the master file | 100% incl. gateway |
| D6 | External / cloud link dead or restricted | Yes, if not fixed within **48h** of the dispute | Staff open the link in a private window | 100% incl. gateway |
| D7 | **[PROPOSED]** A listed extra file (Word / PPT / ZIP / video) or link from "What's included" is missing or corrupt, main file is fine | Yes, if not fixed within 48h | Open each item listed under "What's included" | **Full refund by default** (seller fault, objective). Partial refund only with the buyer's written agreement |
| D8 | Contains banned content (official past papers, another student's work, contact QR codes) | Yes | §5 checklist | 100% incl. gateway + strike |
| D9 | Duplicate purchase of the same item by mistake | Yes | Two paid orders, same buyer, same listing | Second order refunded **minus gateway fee** |
| D10 | Changed mind / accidental purchase, **not downloaded** | Courtesy only, not a right: `download_count == 0`, reported within **1h** of payment, **once per account** | Logs | Listed price **minus gateway fee** |
| D11 | Changed mind after download | **No** | | |
| D12 | "Not useful", style, handwriting, formatting, "too basic" | **No** (preview shown before purchase) | | |
| D13 | Didn't get the grade / level | **No** | | |
| D14 | Outdated syllabus | **No**, unless the listing explicitly states a syllabus year or session the file contradicts (then D3) | | |
| D15 | Found it cheaper or free elsewhere | **No** | | |
| D16 | HK$0 free item | No refund (nothing paid); content problems go through **Report** | | |

### 2.2 Marking services (#556 dual timer)

| # | Claim | Eligible? | Refund |
| --- | --- | --- | --- |
| M1 | Seller missed `seller_due_at` | Yes, **automatic** | 100% incl. gateway |
| M2 | Delivered file won't open, or has zero annotations / comments | Yes (within 72h of delivery) | 100% incl. gateway |
| M3 | Seller marked the wrong document or ignored the stated scope entirely | Yes | 100% incl. gateway |
| M4 | Buyer cancels **before** the seller downloads the draft | Yes | Price **minus gateway fee** |
| M5 | Cancel after marking began | No | |
| M6 | Disagrees with predicted grade or strictness | No | |
| M7 | Buyer asked for ghostwriting | No refund; buyer permanent ban (§5) | |

### 2.3 Partial refunds

Default is **all or nothing**: every eligible row above is a full refund.
A partial refund is allowed only when (a) the seller is at fault on part
of a multi-item listing (D7) **and** (b) the buyer accepts the partial
amount in writing in the dispute thread. Staff record the agreement in
`resolution_note`. Partial refunds still come only from held funds.

---

## 3. Dispute procedure (staff)

### 3.1 Intake (buyer side, automatic)

1. Buyer opens "Report a problem" on the order (button visible only inside the window).
2. Buyer picks a reason (`corrupt_or_blank`, `materially_misrepresented`, `broken_external_link`; marking, **[PROPOSED]** for #556: `missed_deadline`, `no_feedback`, `wrong_scope`) and writes at least 10 characters.
3. **Evidence required:** a screenshot or screen recording for D2 / M2 claims when the logs show a download; page references for D3-D5.
4. Order → `disputed_frozen`; auto-release paused; hold clock stops.
5. Seller notified: "A buyer reported a problem. Reply or fix within 48 hours."
6. Buyer sees the warning copy from #543 (false claims may suspend the account).

### 3.2 Timeline

| Step | Deadline |
| --- | --- |
| Seller response / fix (re-upload, restore link) | **48h** after the dispute opens |
| Staff first look (triage, P1 contraband check) | **1 business day** after the dispute opens |
| Staff decision | **2 business days** after the seller responds or the 48h passes **[PROPOSED]** |
| Escalation to ops lead (Tim / Austin) | Any case staff cannot settle with the rubric, any amount over HK$500, any fraud or ban decision |

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
| Refund, seller fault | refunded | 100% incl. gateway | seller asked to fix; unpublish if the master is bad | per §5 if fraud / banned |
| Refund, buyer-initiated (D9, D10, M4) | refunded | price minus gateway | unchanged | none |

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
| **P1** | `copyright` (official past papers, textbooks, school papers), ghostwriting offers, contact harvesting (`contact_details`), suspected fake / decoy file, `impersonation` | Staff may **hide the listing immediately** pending review | **24h** |
| **P2** | `not_as_described`, fake or shill reviews, `harassment`, `inappropriate_image` | none | **3 business days** |
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

- Only buyers with access can post (enforced in code: `orderGrantsNoteAccess`).
- A seller may report a review for: contact details, harassment or vulgarity, content about a different product, or evidence of shill / secondary accounts.
- **A negative but honest review is never removed.** Staff never edit review text; they remove it or keep it.
- **[PROPOSED]** Add `material_review` as a report target type so the report menu sits on each review (today reviews can only be reported through Help).

### 4.4 Third-party IP takedown

A rights holder (publisher, school, exam board) writes in through Help.
Staff hide the listing within **24h** of a credible notice (identifies the
work and the listing), notify the seller, and allow a counter-notice within
7 days with proof of ownership. Category 1 strikes apply once confirmed.

---

## 5. Banned content and the strike ladder

The full table is locked in #559 §D. Summary:

| Category | Example | 1st | 2nd | 3rd |
| --- | --- | --- | --- | --- |
| 1 Copyright / exam authority | HKEAA, IBO, CIE, Pearson papers or markschemes; school confidential papers; textbook scans | Remove listing + Strike 1 | Permanent selling ban | |
| 2 Ghostwriting | Writing an IA / EE / SBA / TOK / personal statement for a student | Permanent ban (seller and buyer) | | |
| 3 Fee avoidance | Phone numbers, WhatsApp, WeChat QR, payment links in files, previews or bios | Hide + Strike 1 | 30-day suspension | Permanent ban |
| 4 Bait and switch / blank file fraud | Decoy, blank or locked file | 100% refund incl. gateway + permanent ban + freeze held payouts | | |
| 5 Buyer refund abuse | False "corrupt / not received" claims after download; chargebacks on valid files | Dispute rejected + Strike 1 | Permanent buying ban + evidence to Stripe Radar | |
| 6 Harassment / fake reviews | Doxxing, vulgarity after warnings, shill reviews | Remove + Strike 1 | 14-day suspension + manipulated ratings removed | Permanent ban |

5.1 `strike_count` persists across suspensions and is always visible on
the staff user record.

5.2 What counts as a strike is decided once per incident, not per file: a
seller who uploads five official past papers in one go gets **one** Category
1 strike (and all five listings removed). **[PROPOSED]**

5.3 Strikes do not expire in V1. **[PROPOSED: revisit after 6 months of data.]**

5.4 **Contraband found on a live listing:** unpublish; every order on it
still in `paid_held` / `delivered_held` / `disputed_frozen` is refunded
100% incl. gateway; released orders are not refunded (golden rule) but the
strike stands. A permanent ban freezes new listings and login immediately;
legitimate released payouts complete unless the fraud concerns those
specific orders.

---

## 6. Evidence and records

- Sources of truth: `material_download_logs` (every 15-minute signed URL),
  the stored master file, the listing snapshot (title, summary, page count,
  seller-picked preview pages, "What's included"), buyer screenshots, the
  dispute thread.
- Staff write the rule ID (D1-D16, M1-M7, category 1-6) in
  `resolution_note` for every decision, so outcomes are auditable and
  consistent.
- Keep dispute and report records for at least 2 years **[PROPOSED; check
  with counsel against the privacy policy]**.
- Weekly ops review: disputes opened / refunded / rejected, median time to
  decision, top rule IDs, repeat sellers and buyers.

---

## 7. Message templates (EN + 繁中)

**Refund approved (seller fault)**
EN: We reviewed your report and confirmed the problem (rule {ID}). A full refund of HK${amount}, including the payment fee, is on its way to your original payment method.
繁中：我們已審核你的申報，並確認問題屬實（規則 {ID}）。全數 HK${amount}（包括付款手續費）將退回至你原本的付款方式。

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

## 8. Open decisions for sign-off

1. D7 extras / links: full refund by default, partial only with buyer consent?
2. Staff decision SLA of 2 business days after the seller's 48h.
3. One strike per incident (not per file); strikes never expire in V1.
4. `material_review` as a report target.
5. Record retention period (2 years?) and any HK$ threshold above which the ops lead must sign off (proposed HK$500).
