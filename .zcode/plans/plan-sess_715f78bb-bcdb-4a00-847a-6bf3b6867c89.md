# Issue #181 — finish removing email from the case request flow

The email field is already gone from the form UI, zod schema, insert payload, draft (key `case-request-v6`), and admin views (removed in commit `561b878`). What still ties email to the case flow:

1. DB column `tutoring_cases.contact_email` (added in migration `20260910010000`, never dropped) — **note: dropping it permanently deletes any emails stored on cases created Sep 10 – Oct 4; the column is unused everywhere (no UI, API, or notification reads it; cases are contacted via phone/WhatsApp)**
2. `src/integrations/supabase/types.ts` lines 689/735/781 — generated `contact_email` fields under `tutoring_cases` (the ones at 229/258/287 belong to `organizations` and stay)
3. `src/lib/cases.functions.ts:123` privacy comment still lists `contact_email`

## Steps

1. **Branch** `issue-181-remove-case-email` off `main` (tree is clean).
2. **Migration** `supabase/migrations/20261005120000_drop_case_contact_email.sql`:
   `ALTER TABLE public.tutoring_cases DROP COLUMN IF EXISTS contact_email;`
   No views/policies depend on it (verified all other `contact_email` migration hits are `app_settings`/`organizations`).
3. **Apply the migration to prod** (Supabase project `igtqwupxipvxkrinaxiw`) via the Supabase MCP — same pattern as prior migrations.
4. **Hand-edit `types.ts`**: remove the three `contact_email` lines under `tutoring_cases` (Row/Insert/Update). No typegen script exists in the repo, so edit to match the post-migration schema.
5. **Update the comment** at `cases.functions.ts:123` to `// Never contact_name / contact_phone / student_school / student_grade_current.`
6. **Verify**: `npx tsc --noEmit`; targeted eslint on the two touched TS files (no i18n/user-facing text changes, so `check:i18n` not needed).
7. **Commit, push, open PR** referencing "Closes #181" using the `GH_TOKEN` from `git credential fill` (gh CLI is unauthenticated otherwise).

Out of scope: `.opencode/plans/tutor-request-3-page-form.md` (stale historical planning doc — leaving as record).