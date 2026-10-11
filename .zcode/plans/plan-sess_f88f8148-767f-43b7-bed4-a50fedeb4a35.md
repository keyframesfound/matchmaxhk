Implement Issue #112 — Core Multi-Currency Schema, Exchange Rate Engine & Standardization

## Summary

Add a `supported_currency` enum (HKD, CNY, USD, GBP, EUR, CAD, AUD, SGD), an `exchange_rates` table fed daily from Frankfurter (ECB rates, no API key, supports all 8 currencies vs base HKD), native + HKD-normalized price columns on `tutors` and `tutoring_cases` maintained by DB triggers (the issue's "pre-save hooks"), `match_tutors_for_case` updated to score in normalized HKD, and a shared `src/lib/money.ts` that consolidates today's ~7 duplicated HKD formatters and exposes `convertCurrency` / `normalizeToHkd`.

Decisions taken (unanswered questions → recommended defaults): FX refresh = lazy stale-while-revalidate **plus** a Nitro scheduled task + daily Cloudflare cron trigger (reversible, added via API); budget modeling = existing `budget_min/max` reinterpreted as the native values with new `budget_min_hkd/budget_max_hkd` normalized columns (additive, no redundant `_native` duplicates); migration will be applied to prod Supabase via the Supabase MCP, matching prior practice.

## 1. Migration `supabase/migrations/20261005HHMMSS_add_multi_currency_core.sql`

Single transactional file:

1. **Enum + rates table**
   - `CREATE TYPE public.supported_currency AS ENUM ('HKD','CNY','USD','GBP','EUR','CAD','AUD','SGD')`
   - `exchange_rates (source_currency supported_currency, target_currency supported_currency, rate numeric(16,8) NOT NULL CHECK (rate > 0), updated_at timestamptz NOT NULL DEFAULT now(), PK (source_currency, target_currency))`; RLS on, `SELECT` to public, no write policies (service role bypasses).
   - Seed HKD→each currency with current approximate rates (marked "initial estimates; engine refreshes") so normalized values exist before the first fetch.
2. **SQL helpers**
   - `fx_rate_to_hkd(cur supported_currency) returns numeric` — 1 for HKD, else `1/rate` of the HKD→cur row (NULL if missing).
   - `normalize_to_hkd(amount numeric, cur supported_currency) returns numeric` — `round(amount * fx_rate_to_hkd(cur), 2)`.
3. **tutors** (the issue's "tutor_profiles")
   - Add `currency supported_currency NOT NULL DEFAULT 'HKD'`, `min_hourly_rate_hkd numeric(10,2)`, `max_hourly_rate_hkd numeric(10,2)`, index on `min_hourly_rate_hkd`.
   - `BEFORE INSERT OR UPDATE OF currency, hourly_rate, pricing_tiers` trigger: rates = pricing_tiers rates (or `[hourly_rate]` when empty); set `min/max_hourly_rate_hkd = normalize_to_hkd(min/max(rates), currency)`.
   - Backfill all existing rows (all HKD today).
4. **tutoring_cases** (the issue's "case_requests")
   - Add `budget_currency supported_currency NOT NULL DEFAULT 'HKD'`, `budget_min_hkd numeric(12,2)`, `budget_max_hkd numeric(12,2)`. `budget_min/budget_max` stay the native inputs (comment documents this; no duplicate `_native` columns).
   - `BEFORE INSERT OR UPDATE OF budget_currency, budget_min, budget_max` trigger computing the `_hkd` columns; backfill existing rows.
   - Comment: `_hkd` are snapshots at write time (daily FX drift is acceptable); a re-normalization `UPDATE` is documented in a comment for manual use.
5. **match_tutors_for_case** — replace the budget scoring block to compare `COALESCE(t.min_hourly_rate_hkd, t.hourly_rate)` against `COALESCE(c.budget_min_hkd, c.budget_min)` / `COALESCE(c.budget_max_hkd, c.budget_max)`. Signature unchanged.

## 2. FX engine

- **`src/lib/fx.server.ts`** (server-only): `fetchFrankfurterRates()` → `https://api.frankfurter.app/latest?base=HKD&symbols=CNY,USD,GBP,EUR,CAD,AUD,SGD`; `refreshFxRates()` upserts via `supabaseAdmin` (service role, no poisoning surface); `ensureFreshRates(maxAgeHours = 24)` reads `max(updated_at)` and refreshes only when stale (idempotent; concurrent refreshes harmless).
- **`src/lib/fx.functions.ts`**: `getExchangeRates` GET server fn (public, like `getPublicCaseBoard`) — calls `ensureFreshRates()`, returns rate rows; used by any client-side conversion and as the observable "engine works" check.
- **Nitro scheduled task** `tasks/refresh-fx.ts` calling `refreshFxRates()`, wired in `vite.config.ts` via `nitro({ scheduledTasks: { "fx:refresh": "0 22 * * *" }, experimental: { tasks: true } })` (verify exact Nitro 3 beta keys against its docs/types during implementation). Then add the daily `0 22 * * *` cron trigger to the prod Worker via the Cloudflare MCP API. **Fallback:** if the Nitro 3 beta tasks API fights back at build time, drop the task + cron and ship lazy refresh only (still satisfies the acceptance criteria).
- On Frankfurter failure the table keeps last-known rates (staleness is harmless for daily rates).

## 3. `src/lib/money.ts` (new shared module)

- `SUPPORTED_CURRENCIES`, `CurrencyCode`, `DEFAULT_CURRENCY = "HKD"`.
- `convertCurrency(amount, from, to, rates)` (cross-rate through HKD), `normalizeToHkd(amount, from, rates)`, `toHkdLookup(rows)`.
- `formatMoney(amount, currency = "HKD")` — single `Intl.NumberFormat("en-HK", { style: "currency", currency, maximumFractionDigits: 0 })` core, plus a cents variant.
- Refactor the duplicates to call it: `formatHkd` in `MatchFeePanel.tsx`, `_authenticated.admin.referrals.tsx`, `referrals-section.tsx`; `formatCaseBudget` (`cases/display.ts`); `formatBudget` (`cases/admin/shared.ts`); `formatCoursePrice` (`features/courses/queries.ts`). Display output for today's all-HKD data is unchanged.

## 4. App wiring (acceptance criteria)

- **`src/integrations/supabase/types.ts`** (hand-maintained): add `supported_currency` to Enums, the `exchange_rates` table, and the new columns on `tutors` / `tutoring_cases`.
- **`src/features/tutors/queries.ts`**: add `currency, min_hourly_rate_hkd, max_hourly_rate_hkd` to the tutor select list and `Tutor` type.
- **`src/features/tutors/tutor-display.ts`**: `getTutorPriceDisplay` prefers `min/max_hourly_rate_hkd` when present (falls back to the legacy pricing_tiers/hourly_rate derivation for pre-migration tabs). This one change makes the `/tutors` price filter, price sort, and histogram use the normalized HKD index — the sorting acceptance criterion.
- **`src/lib/cases.functions.ts`**: `PUBLIC_CASE_COLUMNS` + `PublicCaseBoardItem` gain `budget_currency`, `budget_min_hkd`, `budget_max_hkd`; zod accepts optional `budgetCurrency` (enum of the 8 codes) persisted to `budget_currency` — the form itself stays HKD-only until issue #114 adds the selector.
- **Budget displays**: `cases/display.ts`, `cases/admin/shared.ts`, `_authenticated.admin.cases.tsx` (list + CSV, labels stay "(HKD)"), `MatchFeePanel.tsx` (also select + prefer `min_hourly_rate_hkd` for the matched-tutor rate) all switch to the `_hkd` columns with legacy fallback.
- No i18n copy changes and no visual UI changes in this issue (#113 tutor currency UI and #114 parent currency selector build on this schema).

## 5. Verification & rollout

1. `npx tsc --noEmit`; targeted `npx eslint --fix` on touched files; `npm run check:i18n` (expect no changes); `npm run build`.
2. Apply the migration to prod (`rzhxzblqmuznrploannp`) via the Supabase MCP; verify via `execute_sql` that backfills populated `_hkd` columns and seeds exist.
3. Branch `issue-112-multi-currency-core` → PR; deploy.
4. Add the Cloudflare cron trigger (daily 22:00 UTC ≈ 6am HKT) after the scheduled-task code is live; confirm `exchange_rates.updated_at` advances.
5. No dependency changes → `bun.lock` untouched.

Risks: Nitro 3 beta tasks API (fallback = lazy-only, planned); stale clients reading new columns are covered by the existing schema-drift fallbacks; additive columns keep the currently-deployed bundle fully functional.