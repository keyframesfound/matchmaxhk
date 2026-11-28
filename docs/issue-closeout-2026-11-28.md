# Open-issue close-out — 2026-11-28 (Asia/Hong_Kong)

Final V1 pass over the six open V1-labelled tickets, plus the pre-existing
#625 referral work already on `main`. The code on `main` is the authority.

## Closed with evidence

| Issue | What this pass added / verified |
| --- | --- |
| #824 | Help category names + article titles localized for en / zh-HK / zh-CN; article canonical/hreflang now follow the URL locale; zh-CN group classes use 小组班; `/become-a-tutor` is `noindex`. Live `/cn/help`, `/zh/help`, `/cn/group-classes` verified. |
| #825 | Desk guards throw `statusCode: 403`; a function middleware stamps the response so non-staff get 403 instead of 500; cockpit / outcome ledger / fee-screenshot handlers admit `staff`. |
| #784 | Fixed the 72h sweep reading a non-existent `material_disputes` table; disputes now freeze on `paid_held` / `delivered_held` as `disputed_frozen`, start a 48h seller reply clock, and resolve from every hold state. Live constraints widened; rolled-back live test passed. |
| #783 | BYOS waived cases now reveal contact (no `case_fees` row ever exists); dead `materials.upload_not_verified` key removed. Cookie / promo-cap / contact-reveal code re-verified. |
| #816 | Four desk queue chips (all / unpaid admin fee / waiting intro / L1 / L2), phone-view audit rows, staff CSV without parent phones, admin-only fee refund + UI, `intro_group_opened` milestone, staff-role fixes for cockpit + ledger. |
| #828 | Calendar route title fixed; tutor `/dashboard#lessons` anchor restored through a shared constant; existing session-log / clash / cancel / tuition evidence re-verified. |

## Still open on purpose

- **#625** — has the `manual` label ("handled personally by the owner — agents
  must not build"). The code, live payout-gate RPC/triggers and tests are on
  `main`; the Master Sheet and Handbook edits are owner-only and remain.

## Verification (repo)

```
npx tsc --noEmit                           exit 0
npx vitest run                             239 files, 2679 tests passed
npm run check:i18n                         5608 keys × 3, OK
npx eslint <changed files> --no-cache      exit 0
npm run build                              exit 0
```

## Live database checks

- `material_orders` gained `dispute_seller_reply_due_at` / `seller_responded_at`;
  the dispute-open and dispute-status check constraints were widened.
- Rolled-back update of a `paid_held` order: `status=disputed_frozen`,
  `dispute_status=open`, `reply_window=2 days`; rollback restored the row.
- `referral_payout_gate` and its two triggers exist on the linked project.

## Ops gates that remain (not code)

- A real Stripe **test-mode card charge**, then live keys, for #784/#783's
  live-charge ACs. The production checkout endpoint already serves a test
  publishable key; the repo holds no secret values.
- The first real **BYOS claim** needs a Google-authenticated parent; accepted
  on unit evidence + desk monitoring per #783's option 2.
- #625's Master Sheet / Handbook edits, as above.
