## Goal

Turn v1 into a working product: real tutors on the landing page, an admin CRUD to add them, no dead buttons, a "become a tutor" info page, and friendlier vocabulary (no raw role names like "parent").

## 1. Database: `tutors` table

New migration creating `public.tutors`:

- Fields: `id`, `display_name`, `headline`, `subjects text[]`, `district`, `hourly_rate int`, `badge`, `bio`, `photo_url`, `tutor_code` (unique, short), `rating numeric(2,1) default 0`, `review_count int default 0`, `weekly_rating numeric(2,1) default 0`, `weekly_score int default 0` (used to pick "highest-rated this week"), `is_published bool default true`, `created_by uuid`, `created_at`, `updated_at`.
- Grants: `SELECT` to `anon, authenticated` (public directory); full CRUD to `authenticated` gated by RLS; `ALL` to `service_role`.
- RLS policies:
  - Public/anon read only where `is_published = true`.
  - Admin/super_admin: full insert/update/delete via `has_role`.
- `updated_at` trigger.

No seed data — admin will add tutors.

## 2. Landing page: real featured tutors

`src/routes/index.tsx`:

- Replace hardcoded `featuredTutors` array with a `useQuery` reading published tutors ordered by `weekly_score desc, weekly_rating desc, rating desc` limit 3.
- Loading skeleton + empty state ("Tutors coming soon") so page never looks broken pre-seed.
- Hero preview card uses the first fetched tutor when available.

## 3. Admin: manage tutors

New route `src/routes/_authenticated.admin.tutors.tsx`:

- Table of tutors (name, subjects, district, rate, rating, published toggle).
- "Add tutor" dialog with form (zod-validated): display_name, headline, subjects (comma input → array), district (select from HK districts list), hourly_rate, badge, bio, photo_url, tutor_code, initial rating, weekly_score.
- Edit + delete actions.
- Route protected by same admin gate pattern as existing admin pages.
- Add card + link on Dashboard (already stubbed as "Tutors" — wire `to: "/admin/tutors"`).

## 4. "Become a tutor" info page

New public route `src/routes/become-a-tutor.tsx`:

- Explains joining process, shows WhatsApp contact (reads `whatsapp_number` from `app_settings`; falls back to "TBC — contact coming soon").
- Big WhatsApp CTA button (disabled/greyed when TBC).
- Own `head()` meta.

## 5. Wire up all buttons / no dead links

Landing (`index.tsx`):
- Hero "Get matched" primary → `/auth` (already).
- Hero secondary "See tutors" → smooth-scroll to `#tutors` (keep).
- "View all" in Featured → new `/tutors` route OR keep as `#tutors`; make it a real `<Link>` to a simple `/tutors` directory page listing all published tutors (server-side query, cards).
- Subject chips → `/tutors?subject=math` (directory page reads search param and filters).
- "Become a tutor" CTA banner → `/become-a-tutor`.
- Hero "Contact via tutor code" card button → scroll to tutors section (visual demo only, add title tooltip).

SiteHeader:
- "Post case" (nav + top-right button for logged-out) → currently `/auth`; keep, but relabel to friendlier copy.
- "Find tutor" → `/tutors`.
- "How it works" → `/#how` (keep).

Footer: audit any dead links, point to real routes or remove.

New `src/routes/tutors.tsx`:
- Public directory page listing all published tutors with subject filter from `?subject=`, district filter, search box.

## 6. Vocabulary refinements

Stop surfacing internal role slugs. In `en.json` and `zh-HK.json`:

- Dashboard badge "Your role: parent" → replace with friendly label: Parent → "Parent / Student", Tutor → "Tutor", Staff → "Team", Admin/super_admin → "Administrator".
- Add helper `roleLabel(role)` in `useAuth.tsx` (or a small `src/features/auth/roleLabel.ts`) returning the translated friendly label; use it in Dashboard, admin users table, header dropdown label.
- Admin users page role select still uses raw enum values (needed), but display column uses friendly labels.
- Landing/nav copy: "Post case" → "Request a tutor". "Find tutor" → "Browse tutors". "Sign in to be a tutor" flows point to `/become-a-tutor`.

## 7. Verification

- `bunx tsgo` typecheck.
- Playwright: load `/`, confirm featured section renders (empty state acceptable pre-seed); load `/become-a-tutor`; click through subject chip → `/tutors?subject=math`.
- After adding a test tutor via admin, confirm it appears on landing when weekly_score set.

## Out of scope

- Case-posting flow, matching engine, tutor self-signup form (deferred to Phase 3 as originally planned).
- Weekly rating auto-computation — `weekly_score` is admin-editable now; a scheduled recompute can come later.

## Technical notes

- Directory/landing reads use the browser Supabase client with anon SELECT (no server fn needed).
- Admin mutations use the browser client under RLS `has_role` policies.
- Tutor photo: URL input only for now (no upload UI).
