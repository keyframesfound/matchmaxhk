# Notes marketplace rollout — #203 + P8/P9/P13 + notes-P14 + marketplace slice of P6 (+ closes #250 via #291)

Branch: `issue-203-notes-marketplace` (off post-#291 main). One family PR; closes each issue via the body.

## Confirmed decisions (Ryan)
- WhatsApp buy stays, but re-shaped: note page CTA = **Add to cart** → authed checkout page `/orders/$id` shows order id + FPS instructions + screenshot upload; the **purchase button opens WhatsApp** with a prefilled "I want to buy [title] ([order ref])" message. Staff remain cashier in /admin.
- Clastify-style preview: extended watermarked preview (~30% of pages, cap 12). Note page renders it client-side (pdfjs); **first 3 pages crisp, the rest blurred** with lock overlay. Blur is CSS in-browser — no server rasterisation (Workers).
- Sample images: **auto-generated from the PDF** at upload (canvas render of preview pages), no tutor upload step.
- Scope: notes marketplace only. D-series centre shop and account epic P1–P5/P7 stay open.

## Migrations (one file)
`supabase/migrations/<ts>_notes_marketplace_lifecycle.sql`
1. `digital_materials`: add `status` (draft/pending_review/published/hidden/rejected, default derived from `is_published`), `rejection_reason`, `submitted_at/reviewed_at/reviewed_by`, `view_count/save_count/sold_count` (sold backfilled from delivered orders), `preview_pages`, `pending_original_file_path` + `edit_status` (null | pending_review | rejected) for P9 live-file-edit staging, `description` reuse as contents. Backfill, rewrite reads/RLS to `status='published'`, drop `is_published`.
2. `material_orders`: add `reference` (short MM-XXXXXXX, app-generated, unique), `payment_screenshot_path`, `receipt_sent_at`.
3. `material_views` view-log (unique material_id+account_id+day; owner/anonymous views don't count).
4. Private bucket `orders-screenshots` (service-role only), matching materials-originals pattern.
No bell/notification tables (P12 waits for the #205 bus).

## Server functions (src/features/materials/)
- `notes.functions.ts`: public note-by-slug + view increment + published-list query (status rewrite; sort newest/price/sold).
- `note-drafts.functions.ts`: saveNoteDraft (P8 partial-ok), submitForReview (required title/price/PDF; encrypted-PDF reject "upload an unlocked file"; contact filter on title+description; price floor HK$30), getMyMaterials (all statuses), editLiveNote (P9: text/price live after contact filter; new PDF → edit_status pending, old file stays on sale), hideNote/unhide.
- `checkout.functions.ts`: startCheckout (auth + published + unique-order guard → awaiting_payment + reference), getMyOrder, uploadPaymentScreenshot (≤5MB image → private bucket), getBoughtMaterials (P13, refunded rows labelled, no download).
- Staff (admin route): markPaid(fps_reference) → releaseOrder (stamps order id + buyer account id footer; fail → stamp_failed; success → delivered + receipt email via Resend registry pattern) / rejectOrder.
- Download reuses #291 `getOwnedMaterialUrl` (10-min signed link, delivered-only). Receipt email: order id, title, amount; no file, no tutor contact.

## Preview pipeline (watermark.ts)
`buildExtendedPreview` = existing `watermarkPdfPreview` with `pageLimit = clamp(ceil(0.30 × pageCount), 5, 12)`; store `preview_pages`. Author-metadata strip at stamp time (pdf-lib custom metadata rewrite). Sample images rendered from preview pages 1–2 server-side (@napi-rs/canvas, Pi-safe) into materials-previews; validate `PDFDocument.load(..., {ignoreEncryption:false})` to catch encrypted files.

## Routes / UI (Twitter-Azure rules: azure only on money CTAs, hairlines, sentence case, max-w-5xl detail rail)
- `/notes/$slug` public detail (Clastify layout): left = pdfjs viewer (3 crisp pages → blur-md + lock overlay + gradient fade), right = sticky buy card (price 700, tutor badge, **Add to cart** azure, Request-this-tutor neutral WhatsApp, owner stats views/sold, icon-only ReportMenuButton), below = description + details table + same-tutor notes. SSR, indexable, noindex owner-drafts never route.
- `/orders/$id` authed checkout/status: order ref + FPS instructions + screenshot upload + WhatsApp purchase button (brand-whatsapp green) + status timeline (awaiting → paid → preparing → delivered → Download button) + refund label.
- `/account` (P6 slice): identity header (avatar/name/rating), tutor blocks = My notes (badges draft/pending/rejected/hidden, Edit per row, Add a note), parent blocks = Bought (title/date/Download or Refunded). Remaining P6 criteria stay on #286.
- `/account/notes/new` + `/account/notes/$id/edit`: draft-or-submit form (P8), contact-filter client errors, draft autosave on navigate.
- `/admin/materials`: status queue (pending first), reject-with-reason, orders desk (mark paid → release/reject), screenshot signed thumbnail, payout CSV (from #291).
- P14: `'material'` added to ReportTargetType; icon-only report on note page (not on own notes).
- material-card buy CTA → Add to cart (routes to checkout); logged-out → AuthGateDialog then continue (P10 pattern).

## Copy/i18n
All new strings in en + zh-HK under `notes.*`, `orders.*`, `account.*`. No dangerous claims ("school-specific past paper solutions" stays banned). Public copy keeps pay-MatchMax licence wording.

## Verification
- vitest: submit-validation matrix, money rounding, status transitions, reference gen, view-log dedupe rules (pure helpers, matching tests/materials/orders.test.ts style).
- tsc --noEmit (background), eslint on touched files, `npm run check:i18n`.
- Screenshots: /notes/$slug + /tutors?view=materials desktop+390px from throwaway vite dev (anon DB reads work); authed flows verified via build+tsc+tests, noted on the PR.
- CI = Cloudflare Workers Builds after merge; post-merge prod spot-check per skill.
