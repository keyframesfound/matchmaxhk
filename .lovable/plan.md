# Site-wide dark mode with System / Light / Dark

Add a theme control to the Settings page with three options — System, Light, Dark — that applies across the whole site (public pages, forms, tutor profiles, admin) and is saved to the user's account so it follows them between devices.

## What the user gets

- A "Appearance" card on Settings, above Danger zone, with three selectable tiles: System (follows the device setting), Light, Dark.
- Choosing an option applies instantly, no reload, and saves to the account.
- Signed-out visitors follow their device setting by default; the last choice is also mirrored into the browser so there is no flash of the wrong theme on load.
- Dark palette is deep navy: page background built on the MatchMax navy (#041344), cards a lighter navy surface, teal/cyan accents preserved.

## Current state that shapes the work

`src/styles.css` already defines a full `.dark` token block and the `dark` variant, so the token layer is ready. The blocker is that roughly 139 hardcoded color usages across ~30 components (literals like `#041344`, `#0D47A1`, `bg-white`, `text-white`, `bg-[#f8fafc]`) bypass those tokens. Those must be converted to semantic tokens or the pages will stay white in dark mode.

## Implementation

1. **Theme state**
   - New `src/features/theme/ThemeProvider.tsx` holding `"system" | "light" | "dark"`, resolving `system` via `matchMedia("(prefers-color-scheme: dark)")` (with a live listener) and toggling the `dark` class on `<html>`.
   - Persist to `localStorage` for instant reads; mount the provider in `src/routes/__root.tsx`.
   - Add a small inline script in the root document head that reads localStorage and sets the class before paint, avoiding a light flash on SSR hydration.

2. **Account persistence**
   - Migration adding `theme_preference text not null default 'system'` with a check constraint to `public.profiles` (existing RLS/grants already cover self-select/update; verify and add if the update policy is missing).
   - On sign-in, the provider reads the profile value and adopts it; changing the setting writes back with `supabase.from("profiles").update(...)` and updates localStorage.
   - Signed-out users just use localStorage/system.

3. **Settings UI**
   - In `src/routes/_authenticated.dashboard.tsx`, add an "Appearance" section matching the existing card style, plus a sidebar nav entry with a monitor/sun/moon icon. Three radio-style tiles with icons and short descriptions; saves optimistically with a toast on failure.

4. **Token migration (the bulk of the work)**
   - Extend `src/styles.css` with any missing semantic tokens needed by the app's custom surfaces (e.g. `--surface-subtle` for the current `#f8fafc` page background, `--brand-ink` for navy text, header/footer surfaces) defined in both `:root` and `.dark`.
   - Replace hardcoded colors file by file with those tokens: layout (`SiteHeader`, `SiteFooter`, `StaggeredMobileMenu` + its CSS, `PageSkeleton`), routes (`index`, `tutors.index`, `tutors.$tutorCode`, `how-it-works`, `faq`, `join`, `privacy-policy`, `auth`, dashboard, saved-posts, cases, all `admin.*`), and features/ui components (`public-tutor-card`, `saved-tutors`, `searchable-select`, `lesson-mode-select`, and the shadcn overrides carrying literal colors).
   - Keep brand gradients and the logo unchanged; adjust only where contrast fails on navy.

5. **Verification**
   - Typecheck and production build.
   - Playwright pass in dark mode over landing, browse tutors, a tutor profile, join form, settings, and one admin page, screenshotting each to catch white-on-white leftovers; plus a reload check confirming no light flash.

## Technical notes

- Theme class goes on `<html>`; the existing `@custom-variant dark (&:is(.dark *))` then activates all `dark:` utilities.
- No new dependencies.
- Scope is styling plus one profile column; no changes to tutor, case, or email logic.

## Pre-work: fix existing typecheck errors

The build is currently failing on issues unrelated to dark mode; these get fixed first:

- `/auth` now requires a `search` param, so `Link`/`navigate` calls to it in `SiteHeader.tsx`, `useAuth.tsx`, `_authenticated.tsx`, and `tutors.index.tsx` must pass `search={{ mode: "sign_in" }}` (or make the param optional on the route).
- `src/integrations/supabase/types.ts` is missing `saved_tutors`, breaking `src/features/tutors/saved-tutors.tsx`; regenerate the database types.
