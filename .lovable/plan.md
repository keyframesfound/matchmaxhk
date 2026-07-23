## Changes

### 1. Photo URL optional (admin tutor form)
`src/routes/_authenticated.admin.tutors.tsx`: relabel to "Photo URL (optional)". Zod already allows empty.

### 2. Add "Spanish ab initio" (IB)
`src/features/tutors/examSystems.ts`: append `"Spanish ab initio"` to the IB subject list.

### 3. Dynamic landing-page stats
`src/routes/index.tsx`: replace hardcoded `trustStats`.
- **Students matched** — admin-editable via `app_settings.students_matched` (numeric). Added to `src/routes/_authenticated.admin.settings.tsx`. Migration extends the public-read whitelist policy on `app_settings` to include `students_matched`.
- **Active tutors** — `count` of `tutors` where `is_published = true`.
- **Subjects covered** — distinct subject count aggregated from published tutors.
- **Districts** — keep at 18.

New `fetchLandingStats()` in `src/features/tutors/queries.ts`; landing uses `useQuery` for stats and reads `students_matched` from `app_settings`.

### 4. Landing-page reviews section
Add "What parents say" section at bottom of `src/routes/index.tsx`, fed by a new `fetchFeaturedReviews()` in `src/features/tutors/reviews.ts` (latest published reviews with tutor name). Admins add/edit reviews on each tutor's profile page (existing dialog). Per-tutor review sections stay as-is.

### 5. "Request this tutor" → WhatsApp
`src/routes/tutors.$tutorCode.tsx`: change the button from `Link to="/auth"` to an `<a href={waUrl}>` that opens WhatsApp in a new tab.
- Fetch `whatsapp_number` from `app_settings` (same pattern as `become-a-tutor.tsx`).
- Message: `"I would like to request tutor {tutor_code}"` (URL-encoded).
- URL: `https://wa.me/{digits}?text=...`.
- If `whatsapp_number` isn't set yet, disable the button with a "Contact coming soon" tooltip/label so it doesn't 404.

### Files touched
- `src/features/tutors/examSystems.ts`
- `src/routes/_authenticated.admin.tutors.tsx`
- `src/routes/_authenticated.admin.settings.tsx`
- `src/features/tutors/queries.ts`
- `src/features/tutors/reviews.ts`
- `src/routes/index.tsx`
- `src/routes/tutors.$tutorCode.tsx`
- Migration — whitelist `students_matched` in public `app_settings` read policy.
