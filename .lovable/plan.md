# MatchMax — Build Plan (Phase 1)

Scope locked from your answers: **Foundation + Parent Cases + Auto-Match**, **bilingual EN / zh-HK**, **3 rendered design directions first**, WhatsApp number deferred (placeholder + admin-editable setting).

---

## Phase 0 — Design directions (before any build)

I'll generate **3 rendered landing-page directions** using your brand:
- Logo: MatchMax (navy → teal → cyan gradient wordmark, growth arrow mark)
- Palette: `#041344` `#0A245F` `#1FA8B6` `#2ED5DE` `#77E8EE` `#FFFFFF`
- Content shown: hero ("Find the right tutor, matched for you"), trust strip, how-it-works (3 steps), featured tutors, parent CTA, tutor CTA, footer
- Bilingual toggle visible in header (EN / 繁)

You pick one → I lock its tokens (colors, radii, shadows, type, spacing) into `src/styles.css` and build against it.

---

## Phase 1 — Foundation

**Auth**
- Email/password + Google SSO (via Lovable broker)
- Public `/auth` route; managed `_authenticated` gate for private routes
- Sign-in affordance in header reflects session; proper sign-out hygiene

**Roles (separate `user_roles` table, enum + `has_role` SECURITY DEFINER)**
- `super_admin`, `admin`, `staff`, `tutor`, `parent`
- Seed `super_admin` for `ryanyeung0925@gmail.com` on first sign-in (trigger: if email matches and no super_admin exists, grant)
- Admin page `/admin/users` — search users, grant/revoke roles (super_admin only for admin/staff grants)

**Profiles**
- `profiles` table (id → auth.users, display_name, phone, locale, avatar_url)
- Auto-created via trigger on new user

**i18n**
- `react-i18next` with `en` and `zh-HK` resource files
- Locale persisted in profile + localStorage; header toggle
- All UI strings keyed from day one

**Role dashboards (shells)**
- `/dashboard` routes by role: parent, tutor, staff, admin
- Empty state cards pointing to the features that arrive next

**Settings**
- `app_settings` table (key/value) — holds WhatsApp number, message template, brand contact email; editable by admin

---

## Phase 2 — Tutor data + Directory (needed for matching)

**Taxonomies** (seeded):
- `subjects` (Math, English, Chinese, Physics, Chem, Bio, Econ, BAFS, LS, etc.)
- `levels` (K1–K3, P1–P6, S1–S6, DSE, IB, IGCSE, University)
- `districts` (18 HK districts + "Online")

**Tutors**
- `tutors` table linked to profile: headline, bio, education, experience_years, hourly_rate_min/max, teaching_mode (in-person / online / both), districts[], subjects[], levels[], languages[], verified, active
- Admin **Tutor Creation Wizard** (`/admin/tutors/new`) — 5 steps: account → profile → qualifications → subjects/levels/districts → rate/mode/publish
- Public **directory** `/tutors` with filters: subject, level, district, mode, rate range, language; card grid + tutor profile page `/tutors/:id`

RLS: public SELECT on active+verified tutors only; owner + admin/staff for full row.

---

## Phase 3 — Parent Cases + Auto-Match

**Case creation** `/post-case` (parent, auth required — inline "sign in to post" CTA if not)
- Fields: subject, level, district (or online), mode, budget range, schedule (weekday × time slot chips), language preference, gender preference (optional), notes
- Multi-step form with progress + validation

**Cases table**
- `cases`: parent_id, status (open / matched / closed), all case fields, created_at
- `case_matches`: case_id, tutor_id, score, reasons[], status (suggested / contacted / accepted / rejected), created_at

**Rule-based matching engine** (server function `matchCase`)
- Filters: subject ∈ tutor.subjects, level ∈ tutor.levels, district match or online-ok, budget overlap, language match
- Score components (weighted): subject+level exact (40), district (15), budget fit (15), experience_years (10), verified (10), rating placeholder (10)
- Returns top N (default 10) with score + reason chips

**Recommendation display** on case detail page — ranked tutor cards with score, matched-reason chips, and **"Get Tutor Code"** action

**Tutor Code / WhatsApp handoff**
- On request, generate short code (e.g. `MM-8FJ2K`) bound to (case_id, tutor_id, parent_id), stored in `tutor_codes`
- Show WhatsApp deep link built from `app_settings.whatsapp_number` + templated message including the code + subject/level (placeholder number for now, editable in admin)
- Tutor dashboard: "Incoming leads" list showing codes they've been referred with

**Staff-assisted matching (light hook, full flow later)**
- Cases have `needs_staff_review` flag; staff dashboard lists flagged cases

---

## Technical section

**Stack:** TanStack Start (already scaffolded), Tailwind v4, shadcn, Lovable Cloud (Supabase), TanStack Query, react-i18next, zod + react-hook-form, lucide-react.

**Folder layout (feature-based):**
```
src/
  features/
    auth/           # sign-in, sign-up, session hooks
    profiles/
    roles/          # user_roles, has_role client helpers, admin RBAC UI
    tutors/         # directory, profile, admin wizard
    cases/          # post-case form, case detail, my-cases
    matching/       # scoring engine (server), recommendation UI
    handoff/        # tutor codes, whatsapp link builder
    i18n/           # config + locales/{en,zh-HK}/*.json
    settings/       # app_settings admin
  components/ui/    # shadcn
  routes/           # file-based
  integrations/supabase/  # generated, do not edit
```

**Migrations (Phase 1 first, then 2, then 3) — each with GRANTs before RLS/policies:**
1. `app_role` enum, `user_roles`, `has_role()`, `profiles`, `handle_new_user` trigger, super_admin seed trigger, `app_settings`
2. `subjects`, `levels`, `districts`, `tutors`, join arrays (or normalized `tutor_subjects` / `tutor_levels` / `tutor_districts` — normalized for filter perf)
3. `cases`, `case_matches`, `tutor_codes`, `match_case()` server fn

**Server functions (all `createServerFn`, not edge functions):**
- `grantRole` / `revokeRole` (super_admin gated via `has_role`)
- `createTutorProfile` (admin/staff)
- `createCase`, `listMyCases`, `getCaseDetail`
- `matchCase(caseId)` → writes `case_matches`, returns ranked list
- `issueTutorCode(caseId, tutorId)` → returns code + whatsapp URL
- `updateAppSetting(key, value)` (admin)

Public directory reads use the server publishable client (narrow `anon` SELECT on active+verified tutors); everything user-scoped uses `requireSupabaseAuth`.

**SEO:** per-route `head()` on `/`, `/tutors`, `/tutors/:id`, `/post-case`, `/auth`, `/how-it-works` with unique EN titles/descriptions (zh variants swap via URL param `?lang=zh` in Phase 2.5 if you want localized OG).

**Out of scope for Phase 1 build (roadmap):**
- Reviews & ratings
- Staff full workspace (assignments, notes, timeline)
- Payments / commission
- Messaging in-app (WhatsApp handoff covers Phase 1)
- Tutor self-signup public flow (admin creates tutors this phase)

---

## What happens next

If you approve this plan, I'll switch to build mode and start with **Phase 0: generate the 3 landing-page design directions** and ask you to pick one before any code lands.