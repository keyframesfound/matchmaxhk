# Parent cases (marketplace)

Signed-in parents post tuition cases. Auto-match suggests top tutors on submit. Approved cases become a public/tutor-visible board (anonymized). Admins moderate; tutors express interest; contact info released after admin approval.

## Flow

```text
Parent (logged in) ─▶ /post-case  ──submit──▶ [case row: status=pending]
                                                    │
                                                    ├─▶ /post-case/success shows top 3–5 matches + WhatsApp CTAs
                                                    └─▶ Admin queue (/admin/cases) reviews → approves/rejects
                                                                                 │
                                                     Approved case ─▶ /cases board (anonymized)
                                                                                 │
                                              Tutor clicks "Express interest" ─▶ [case_interests row]
                                                                                 │
                                                Admin releases parent contact ─▶ Tutor sees WhatsApp
```

## Data model (one migration)

**tutoring_cases** — parent-posted requirement

- Owner: `parent_id → auth.users`
- Academic: `subject`, `exam_system` (IB/DSE/IGCSE/A-Level/HKCEE/Other/None), `student_level` (P1–P6, S1–S6, University, Adult), `student_grade_current` (optional text), `student_school` (optional text)
- Logistics: `district`, `mode` (online/in-person/either), `sessions_per_week` (int), `session_length_minutes`, `start_date`, `schedule_note`
- Preferences: `preferred_gender` (any/male/female), `language_of_instruction` (en/zh-HK/either), `preferred_tutor_type` (any/university/full-time/experienced), `urgency` (low/normal/high)
- Budget: `budget_min`, `budget_max` (HK$/hr)
- Description: `title`, `description` (long text)
- Contact: `contact_name`, `contact_phone` (E.164-ish), `whatsapp_ok` (bool)
- State: `status` enum (`pending`, `approved`, `matched`, `closed`, `rejected`), `admin_notes`, `is_public` (default false; flips true on approve)
- Standard: `id`, `created_at`, `updated_at`

**case_interests** — tutor interest on a case

- `case_id → tutoring_cases`, `tutor_id → tutors`, `note`, `status` (`pending`, `contact_released`, `declined`), `created_at`
- Unique (`case_id`, `tutor_id`)

**RLS**

- `tutoring_cases`
  - Parent: full CRUD on own rows (`auth.uid() = parent_id`).
  - Authenticated read of approved+public rows, but through a `public_cases` view that projects only anonymized columns (no contact info, no free-text description if it may contain PII — description shown, contact hidden).
  - Admin/staff/super_admin: full access via `has_role`.
- `case_interests`
  - Tutor: insert/read/update own rows where their `auth.uid()` maps to a tutor row they own (`tutors.created_by = auth.uid()`) OR admins insert on behalf. Simplest MVP: any authenticated user with `tutor` role can insert; only admins can update status.
  - Admin/staff: full access.
- GRANTs to `authenticated` and `service_role`; no `anon`.

## Auto-match (SQL function `match_tutors_for_case(case_id)`)

Server-side ranking (security definer, `TO authenticated`), returns top 5 published tutors ordered by score:

- +40 if `subject = ANY(tutors.subjects)`
- +15 if `district = tutors.district`
- +15 if `budget_max >= tutors.hourly_rate` AND `budget_min <= tutors.hourly_rate` (or overlap)
- +10 if `language_of_instruction` intersects `tutors.languages`
- +10 * `LEAST(experience_years, 10) / 10`
- +5 * `rating` (0–25)
- Tie-break by `weekly_score DESC, rating DESC`
  Only returns published tutors. Also exposed via a server function that any signed-in parent can call for their own case.

## Server functions (`src/lib/cases.functions.ts`)

- `createCase(input)` — parent-only. Zod-validates all fields, inserts, returns `{ caseId, matches }` where `matches` calls the ranking function.
- `listMyCases()` — parent dashboard list.
- `getCase(caseId)` — parent (own) / admin.
- `listPublicCases({ subject?, district?, level? })` — signed-in tutors/parents; reads via server publishable client through the anonymized view.
- `expressInterest({ caseId, note })` — tutor-only.
- `listMyInterests()` — tutor dashboard.
- Admin: `listCasesForAdmin({ status? })`, `updateCaseStatus({ caseId, status, adminNotes? })`, `releaseContact({ interestId })`, `listInterestsForCase(caseId)`.

All authenticated fns use `requireSupabaseAuth`; admin fns verify `has_role('admin' | 'staff' | 'super_admin')` via `context.supabase.rpc('has_role', ...)`.

## Routes

- `src/routes/_authenticated.post-case.tsx` — multi-section form (Academic / Logistics / Preferences / Budget / Description / Contact). Uses `SearchableSelect` for subject (from `app_settings.subject_options`), district, exam system, level. Submit → mutation → navigate to success page with `caseId` in search params.
- `src/routes/_authenticated.post-case.success.$caseId.tsx` — "Case received" + top 5 auto-matched tutor cards with WhatsApp deep-links using the existing `whatsapp_number` template. Link to "View my cases".
- `src/routes/cases.index.tsx` — public-ish board (auth-gated: signed-in only) listing approved public cases, filter chips (subject, district, level). Anonymized cards ("Parent in Sha Tin needs IB Math HL, HK$400–500/hr"). Tutor role sees "Express interest" button; parents see read-only. Uses `validateSearch` for filters.
- `src/routes/cases.$caseId.tsx` — case detail (anonymized); tutors can submit an interest note.
- `src/routes/_authenticated.dashboard.tsx` — extend: "My cases" section for parents; "My interests" for tutors.
- `src/routes/_authenticated.admin.cases.tsx` — admin queue: filter by status, approve/reject with notes, view interests, release contact info to specific tutor (surfaces parent WhatsApp).

## UI wiring

- SiteHeader: add "Post a case" (visible to signed-in parents), "Cases" (all signed-in), "Cases" admin link when admin.
- Landing page "Request a tutor" CTA → `/post-case` (redirects to `/auth?next=/post-case` if signed out).
- Success page + case detail reuse existing tutor card component.

## i18n

Add `cases.*` keys in both `en.json` and `zh-HK.json` (Cantonese-style). Includes form labels, statuses, empty states, admin actions.

## Validation & security

- Zod on every server-fn input; phone regex, budget bounds (0–100000), description max 2000 chars, title max 120.
- Anonymized view excludes `contact_name`, `contact_phone`, `parent_id`, `admin_notes`.
- `contact_phone` never returned to non-owners/non-admins; released to a tutor only when admin creates a `contact_released` interest.
- All tables locked with RLS; no `anon` access.

## Out of scope (later)

- Email/WhatsApp notifications on approval / interest.
- Case editing after admin approval (v1: parent can only close).
- Ratings/feedback loop after a match completes.
