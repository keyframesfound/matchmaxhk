# Settings page overhaul — Claude-style categories + QoL features

## Context found

The settings page lives at `/dashboard` (`src/routes/_authenticated.dashboard.tsx`, ~570 lines): one long scroll with anchor nav, sections for Profile (name + read-only email), Account type (parent/tutor via `switch_role` RPC), Password, Appearance (system/light/dark), Danger zone (delete account). Everything is hardcoded English.

Infrastructure already in place that settings can wire into but doesn't yet:
- `profiles.locale` column — never persisted (language toggle only writes localStorage)
- `profiles.phone`, `profiles.avatar_url` (skipping avatars per your answer), `profiles.tos_accepted_at`
- Supabase `auth.updateUser({ email })` + existing `email-change` Resend template — no UI
- `supabase.auth.signOut({ scope: "global" })` — no "sign out everywhere"
- `PasswordStrength` UI component — unused on this page
- Existing deep links to preserve: `/dashboard` (from header, mobile nav, admin redirects, reset-password) and `/dashboard#profile` (header + mobile "Profile" links)

## New layout (Claude format)

Rebuild the page as category-switching views: sticky left sidebar on desktop (General, Profile, Account, Security, Notifications, Privacy & data, Danger zone + Saved Posts link + Sign out), horizontally scrollable pill row on mobile. Clicking a category shows only that category's content, synced to the URL hash (`#general`, `#profile`, `#security`…). `/dashboard` opens General; existing `#profile` deep link opens Profile; legacy `#appearance`/`#account-type` hashes alias to General/Account.

New primitives in `src/features/settings/`: `OptionCard`/`OptionCardGrid` (Claude-style selectable cards with icon/preview + label + description, selected = ring border + wash, flat/border-delineated per the no-shadow rule) and `ThemeModeCards` (three mini site-mockup preview cards for System / Light / Dark, rendered with the real theme tokens like Claude's color-mode cards).

## Sections & features

1. **General** — Color mode preview cards (existing ThemeProvider, already persists to `profiles.theme_preference`) + Language picker (English / 繁體中文 radio cards): calls `i18n.changeLanguage` AND persists to `profiles.locale`.
2. **Profile** — Display name (existing) + new optional Phone field saving to `profiles.phone` (loose HK validation).
3. **Account** — Change email flow: `auth.updateUser({ email })` fires the existing confirmation-email template, with pending-confirmation hint; Account type switcher (existing `switch_role`, hidden for internal roles); Account overview card (sign-in method from `app_metadata.provider`, member-since date, ToS acceptance date, business portal link if org member).
4. **Security** — Password change (existing) upgraded with the `PasswordStrength` meter + show/hide toggle; new "Sign out of all devices" via `signOut({ scope: "global" })` with confirm dialog.
5. **Notifications** (per your choice: store prefs now) — toggles for case updates, match suggestions, tutor leads (shown when role = tutor), product news; persisted to a new `profiles.notification_preferences` JSONB column; copy notes these power upcoming emails. Defaults: first three on, product news off.
6. **Privacy & data** — "Download my data" (assembles profile + saved tutors/cases/courses + prefs into a JSON download), "Clear local data" (clears `matchmax.draft.*` sessionStorage keys + `matchmax:compared-cases`; leaves theme/language alone), link to the privacy policy.
7. **Danger zone** — existing delete-account flow, restyled.

## Supporting changes

- New migration `supabase/migrations/20260920xxxxxx_add_notification_preferences.sql` (JSONB default, RLS unchanged — profiles own-row update already allowed).
- Add `notification_preferences` to the `profiles` Row/Insert/Update in `src/integrations/supabase/types.ts` (manual edit; DB not reachable locally to regenerate).
- Add `settings.*` keys to both `en.json` and `zh-HK.json` and use them in all new copy (bilingual parity is a product requirement the current page ignores).
- Route file becomes a thin shell; sections live in `src/features/settings/`. No new npm dependencies, so no `bun.lock` change.

## Verification

`npx tsc --noEmit`, targeted `npx eslint` (with `--fix` first) on touched files only, and `npm run build` (per AGENTS.md: Supabase env vars are absent locally, so DB-backed pages are verified via build + typecheck, not curl). No dev server needed since the page is `ssr: false` and auth-gated.
