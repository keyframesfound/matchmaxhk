# Epic #280 — Account owns the card (P1/P2/P3/P5/P6) — build plan

Ryan's decisions (2026-10-14, this session):
- ONE family PR closing **#281 #282 #283 #285 #286**. #284 (evidence queue), #290 (Saved) deferred. #287/P7 + #292/P12 deferred until #205 lesson-done lifecycle.
- **Password login removed entirely** — Google-only. Requires Supabase **automatic linking** (verified email) so legacy password users keep their `auth.users.id` (and thus `tutors.user_id` links) on first Google sign-in. RYAN TODO: verify/enable in Supabase dashboard Auth settings before merge.
- Claim flow: sign-in + **confirmation screen** (email match pre-fills; tutor confirms; no match / already-claimed → staff request row).
- Owner key = `auth.uid()`; `profiles.google_sub` as reference column.

## Current state (recon 2026-10-14, main @ 3c5dd95)
- `tutors.user_id uuid REFERENCES auth.users` (20260926), RLS `tutors_owner_select`/`tutors_owner_update` pin `user_id = auth.uid()`.
- Settings → My Tutor Profile (`my-tutor-profile-section.tsx`) already owner-edits a subset via RLS; excludes `tutor_code` + field state; capacity/availability via `update_my_capacity` / `update_my_availability_grid` RPCs.
- `tutors.contact_email` exists → claim matching key. Verification: `tutors.verification_tier` ('tier_2_verified' etc). Status: `is_accepting_students`, `remaining_student_slots`, `max_active_students` (check exact col in capacity migration), `tutor_status`.
- Contact filter shared: `src/lib/contact-filter.ts` (#215) — currently applied to self_introduction (client) + intake zod (server).
- Auth: `/auth` page = password forms + Google button + Turnstile; `AuthGateDialog` = Google-first sheet with `?save=` draft resume (pattern `tutor|case|course`).
- Account page: `src/routes/account.tsx` (287 lines) — bought materials, note drafts; not the P6 Carousell layout yet.
- Roles: `user_roles` (`super_admin|admin|staff|tutor|parent`), `has_role()` SQL + `useAuth().roles`.

## Stages
1. **Migration** `20261014200000_account_owns_card.sql`
   - `profiles.google_sub text` (unique where not null)
   - `tutors.claimed_at timestamptz`
   - `tutor_claim_requests` table (tutor_id, user_id, email, status open/approved/rejected, resolved_by/at, note) + RLS (owner reads own; admin/staff all) + `request_tutor_claim(p_tutor_code)` SECURITY DEFINER RPC:
     - email matches exactly one card, card unclaimed → return `needs_confirm` + card summary; `confirm_tutor_claim(p_tutor_id)` sets `tutors.user_id`, `claimed_at`, stores `google_sub`.
     - card already claimed (by someone else) or email matches none / multiple → insert `tutor_claim_requests` row (open) for staff.
   - Field-lock trigger for P3: `BEFORE UPDATE ON tutors` — when caller is the owner (not admin/staff) and `verification_tier` is verified, reject changes to school/degree/grades/examiner/achievement fields (old value stays public).
   - Contact-filter trigger on owner updates: reject phone/email/WhatsApp patterns in bio/headline/self_introduction (defensive twin of the client filter).
2. **Auth: Google-only** — strip password forms from `/auth` (keep Google + redirect/save handling), remove forgot-password route + links, hide password UI in settings security section, after-sign-in lands on `/account` when no redirect.
3. **P1 gates** — case-request + become-a-tutor require auth before the form (`AuthGateDialog` / redirect with `?save=` resume); buy/review/account already gated (verify each path).
4. **P2 claim UX** — `/account/claim` confirmation route (pre-filled card summary → confirm/reject); pending-claim + rejected states on account page; admin claims queue (extend admin users or tutors page).
5. **P3 edit surface** — expand `MY_TUTOR_COLUMNS`/form to all free fields (price incl. tiers, subjects, headline, bio, lesson mode, district, languages, photo, portfolio); verified fields render locked with explanation; contact filter on all free-text; owner save path unchanged (RLS + triggers enforce).
6. **P5 status controls** — settings status picker (taking students / full / inactive) + max-active cap wiring to existing RPCs; Request-tutor button hidden + "Full"/"Inactive" chip on card + profile when not accepting.
7. **P6 account page** — Carousell layout: tutor view (identity row: photo/preferred name/code/rating-or-"New"; blocks: pricing+subjects, bio+format, status+capacity+next slots, notes incl. drafts w/ "Add a note" empty state; per-block Edit; public view link) / parent view (name, cases, Bought; NO Saved, no selling block, no phone).
8. **Gates** — i18n en+zh-HK (eslint i18n-guards first), `npx tsc --noEmit`, targeted eslint, vitest (claim + lock helpers), `bun run build:dev` (config touched), screenshots; PR body closes the five issues.

## Guardrails
- Never commit to main; branch `issue-280-account-owns-card` in worktree `.worktrees/issue-280-account-owns-card`.
- Migrations NOT applied from this branch until merge (Workers Builds doesn't run migrations — apply via Supabase MCP after merge, per repo convention).
- Cron must not start parallel P-epic work (noted in matchmaxhk-dev skill).
