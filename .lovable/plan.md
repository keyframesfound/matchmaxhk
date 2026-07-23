## 1. Schema changes (one migration)

**Tutors — richer profile + better defaults**
- Add columns: `education jsonb default '[]'` (array of `{institution, qualification, year}`), `experience_years int`, `teaching_since int` (year), `languages text[] default '{}'`, `intro_video_url text`.
- Change defaults: `rating` default `5.0`, `weekly_rating` default `5.0` (existing rows stay as-is; admin can bulk-set).
- Keep `rating`/`review_count`/`weekly_*` columns — they'll be auto-computed from reviews going forward (see trigger below).

**New `tutor_reviews` table**
- Fields: `id`, `tutor_id → tutors.id (cascade)`, `author_user_id uuid null` (null when admin-authored on behalf of someone), `author_alias text not null` (display name shown publicly, e.g. "Mrs. Chan"), `rating int check 1..5`, `comment text`, `is_published bool default true`, `created_by uuid` (admin/parent who inserted), `created_at`, `updated_at`.
- Grants + RLS:
  - Public/anon: SELECT where `is_published = true`.
  - Authenticated parent: INSERT one review per `(tutor_id, author_user_id)` (unique index); UPDATE/DELETE own review.
  - Admin/super_admin: full CRUD (can post with any alias, on behalf of anyone).
- Trigger `refresh_tutor_rating()` after insert/update/delete: recomputes `tutors.rating` = avg of published reviews (fallback 5.0 when none), `review_count` = count.
- `weekly_rating`/`weekly_score` remain admin-editable (out of scope to auto-compute weekly window here).

## 2. Admin — easier tutor form (`_authenticated.admin.tutors.tsx`)

Replace the current flat form with grouped sections + friendlier inputs:

- **Basics**: display_name, tutor_code, headline, badge, photo_url.
- **Teaching**: subjects (comma), district (select), hourly_rate, languages (comma), experience_years, teaching_since.
- **Education** (repeater): "+ Add qualification" rows with `institution`, `qualification`, `year` inputs; remove button per row. Stored as `education` jsonb.
- **Scoring** (simplified):
  - Overall rating: read-only, shown as "auto from reviews (X reviews)".
  - This week rating: **star picker (1–5)** instead of numeric.
  - Weekly rank score: **slider 0–100** with number display (replaces raw number box).
  - New tutors default to 5★ everywhere.
- Bio, published toggle unchanged.

Zod schema updated; defaults for a new tutor set `rating=5, weekly_rating=5, weekly_score=50`.

## 3. Reviews UI

**Tutor detail route** — new `src/routes/tutors.$tutorCode.tsx` (public):
- Loads tutor by `tutor_code`, shows profile (education, languages, experience, bio) and reviews list.
- Signed-in parent sees "Write a review" (alias defaults to their display_name, star picker, comment). Uses their own `author_user_id`; edits/deletes their own review.
- Admin sees an extra "Add review as…" button opening a dialog with `alias`, `rating` (stars), `comment`, published toggle. Admin can also edit/delete any review inline.
- `/tutors` directory cards link to `/tutors/<tutor_code>`.

**Admin — reviews management**: on the tutor row in `/admin/tutors`, add a "Reviews" action that opens the same tutor page's admin panel (reuse the dialog). Keeps it in one place.

## 4. i18n & vocab polish

Add strings under `tutor.*` and `reviews.*` (en + zh-HK) for: education, qualification, institution, year, experience, languages, write a review, alias, rating, add review as guest, published, no reviews yet, based on N reviews.

## 5. Finalise (small)

- Landing "featured tutors" cards link to `/tutors/<code>`.
- Show `review_count` on featured/directory cards (e.g. "5.0 · 12 reviews", or "New" when 0).
- Become-a-tutor page: unchanged.

## Verification

- `bunx tsgo` typecheck.
- Playwright: as admin, add a tutor with 2 education rows + slider score → appears on landing; open `/tutors/<code>`, add admin review with alias "Mrs. Chan" 5★ → rating auto-updates to 5.0 (1 review). Sign in as parent, post review 4★ → rating recomputes to 4.5 (2 reviews). Edit own review, delete own review — count drops.

## Out of scope

- Photo upload UI (still URL).
- Automatic weekly ranking recompute (still admin-driven; slider just makes entry easier).
- Case-posting / matching flow.

## Technical notes

- `education` stored as jsonb array for schema flexibility; typed as `Array<{institution:string; qualification:string; year?:number}>` in TS.
- Trigger uses `SECURITY DEFINER` + `set search_path = public` and only touches `public.tutors`.
- Unique `(tutor_id, author_user_id) where author_user_id is not null` allows many admin-authored anonymous reviews but one per real user.
