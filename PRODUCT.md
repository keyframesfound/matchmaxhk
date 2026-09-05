# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: Hong Kong parents and students (IBDP, IGCSE, DSE, AP)** seeking a tutor. They browse verified tutors, filter by subject/district/lesson mode, and post cases to get matched. Success = a parent or student successfully matched and starting lessons.
- **Tutors**: top-scoring students and graduates (e.g., HKU) who build a verified profile and receive leads — "You do the teaching. We do the matching."
- **Tutoring businesses**: centres and small teams on org accounts (business/enterprise plans) with branded profiles and published courses.
- **Internal admin**: MatchMax team managing tutors, users, cases, organizations, and settings.

## Product Purpose

A two-sided tutoring marketplace for Hong Kong: parents find and get matched with verified, top-scoring tutors quickly; tutors get a steady stream of students while focusing on teaching; tutoring centres get a branded directory presence and course listings. Success is measured in real matches and lessons started.

## Positioning

Proof-first marketplace: every tutor is a verified top scorer with team-reviewed applications and transcript-checked credentials. A competitor can list tutors, but cannot truthfully claim the same vetting depth behind "verified top scorer."

## Operating Context

- Hong Kong curricula: HKDSE, IBDP, IGCSE, AP; filterable by subject, district, lesson mode (online/in-person), and gender.
- Matching flow: parent posts a case → MatchMax team connects them with the chosen tutor via Tutor Code.
- Tutor applications are reviewed by the team (transcript attached); contact happens via email or WhatsApp.
- Business enquiries arrive via WhatsApp and email; org plans are billed offline.
- Bilingual market: English and Traditional Chinese (zh-HK) are both first-class.

## Capabilities and Constraints

- Public surfaces: home (featured tutors, live stats, reviews), tutor directory + profile pages (tutor code), courses directory + detail, business profiles (`/business/$slug`), how-it-works, pricing (for tutoring businesses), become-a-tutor, case request.
- Authenticated surfaces: parent/student dashboard with saved posts; business portal (courses, team, join, settings); admin console (tutors, users, cases, organizations, R2 media, settings).
- Landing-page trust stats (students matched, active tutors, subjects, districts) are real numbers and must be preserved as facts, not treated as placeholders.
- Transcript AI auto-fill uses OpenRouter (Qwen3-VL, JPG/PNG only) via `OPENROUTER_API_KEY`.
- Tutor profile images and course images are hosted on Cloudflare R2; email delivery via Resend.
- Bilingual parity EN/zh-HK is required for user-facing copy (i18next: `src/features/i18n/locales/`).
- Deployment: Cloudflare Workers (Nitro/wrangler, Bun 1.2.15 frozen lockfile); database/auth via Supabase with RLS.

## Brand Commitments

- Name: MatchMax.
- Logo asset exists at `public/matchmax-logo.png`; favicon set and web manifest in place.
- Bilingual (EN + zh-HK) identity is part of the brand.

## Evidence on Hand

- Real trust stats on the landing page (to be kept truthful).
- Tutor application flow with transcript attachment and team review (`src/features/tutor-application`).
- Example tutor profile content in the join flow (Jayden Lau, HKU) — illustrative sample, not a real claim.
- Product summary at `public/llms.txt`; README with integration setup.

## Product Principles

1. Proof before promise: verification evidence (transcripts, team review) outranks marketing claims.
2. Match speed: a parent should reach a shortlist of suitable verified tutors in seconds, then get human help to close the match.
3. Trust the tutor's time: tutors teach; MatchMax handles finding students.
4. Two languages, one product: every user-facing surface treats EN and zh-HK as equal citizens.
5. Real numbers only: stats and claims on public pages must be backed by actual data.
