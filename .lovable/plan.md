# Restore full `/join` application page and remove the `/become-a-tutor` step page

## Goal

Reinstate the full `/join` tutor application page (site header/footer, intro, sample profile, form) and remove the separate `/become-a-tutor` page with WhatsApp Step 1 and Apply Step 2. Every internal "Join" / "Apply to be a tutor" link will point directly to `/join`.

## Changes

### 1. `/join` page layout

Update `src/routes/join.tsx`:

- Wrap the page in `SiteHeader` and `SiteFooter` so it feels like a real MatchMax page.
- Add a page header section with title, short intro, and a consent note.
- Add a collapsible "Sample tutor profile" panel that shows the expected level of detail for an application.
- Keep the existing 24-field form with its validation, example placeholders, file upload, and consent checkboxes unchanged.
- Place the form inside a card on a soft background so the UI matches the rest of the site (post-case form, admin cards, etc.).
- Add i18n keys for the new header, intro, sample profile labels, and confirmation text in `src/features/i18n/locales/en.json` and `zh-HK.json`.

### 2. Remove the `/become-a-tutor` step page

Replace `src/routes/become-a-tutor.tsx` with a permanent redirect to `/join`. This removes the old WhatsApp + Apply two-step page while keeping any external links/bookmarks from breaking.

### 3. Update all internal links to `/join`

- `src/components/layout/SiteHeader.tsx` (desktop nav and mobile menu)
- `src/components/layout/SiteFooter.tsx` (quick links and support)
- `src/routes/index.tsx` (bottom "Join" CTA)
- `src/routes/how-it-works.tsx` (tutor CTA)
- `src/routes/_authenticated.cases.$caseId.tsx` ("Apply to be a tutor" fallback)
- `src/routes/sitemap[.]xml.ts` — remove the `/become-a-tutor` entry, keep `/join`

### 4. Verification

- Build and typecheck pass.
- Every "Join" / "Apply to be a tutor" link navigates to `/join` in the preview.
- The old `/become-a-tutor` URL redirects to `/join`.
- Form submission still emails matchmaxedu@gmail.com with attachments via Resend.

## Technical notes

- No schema or server-function changes; the form already uses `tutorApplicationSchema` and `submitTutorApplication`.
- No new routes; `/join` already exists, `/become-a-tutor` is repurposed as a redirect.
