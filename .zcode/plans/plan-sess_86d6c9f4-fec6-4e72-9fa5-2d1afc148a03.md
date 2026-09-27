# Issue #107: Multi-Degree Support (Undergrad + Postgrad)

Per your call, the DB follows the issue checklist literally: `university` is renamed to `undergrad_*` (with data backfill), and five new columns are added. Application JSONB keys on `/join` stay unchanged (stored applications keep their shape); only new postgrad keys are added.

## 1. DB migration — `supabase/migrations/20260927XXXXXX_add_tutor_multi_degree.sql`
Following the pricing-tiers migration style (transaction, guarded, commented):
- `ADD COLUMN IF NOT EXISTS`: `undergrad_university text`, `undergrad_degree text`, `undergrad_graduation_year text`, `has_postgrad boolean NOT NULL DEFAULT false`, `postgrad_university text`, `postgrad_degree text`
- Backfill: `UPDATE tutors SET undergrad_university = university WHERE ...` then `DROP COLUMN university`
- `COMMENT ON COLUMN` for each
- Apply to prod via Supabase MCP (same as #106/#109). Public reads stay safe during deploy-order gaps via the existing `withTutorSelectFallback` column-drop resilience.
- "Required" for undergrad fields is enforced in UI (intake already requires them; editor guidance), not DB — existing rows must stay valid.

## 2. Types & query layer
- `src/integrations/supabase/types.ts` — hand-update tutors Row/Insert/Update (replace `university`, add the 5 columns).
- `src/features/tutors/queries.ts` — `Tutor` type (lines 80–110), `SELECT_COLS` (line 123), `normalize()` (~line 280): rename + add; `has_postgrad` normalized to boolean with `false` fallback.

## 3. Formatting helpers — `src/features/tutors/tutor-display.ts`
- `shortenDegree(degree)`: token scan against an acronym map (BSc, BA, BBA, BEng, LLB, MBBS, MSc, MA, MBA, MEng, MEd, LLM, MPhil, PhD, JD, … + spelled-out forms like "Master of Science" → MSc); dual degrees "BBA X & BSc Y" → "BBA/BSc"; fallback = first token.
- `shortenUniversity(name)`: conservative strip — leading "The ", "University of ", trailing " University" ("University of Edinburgh" → "Edinburgh", "Durham University" → "Durham"); returns original if result is empty.
- `getTutorEducationLines(tutor)`: returns icon-tagged lines for card/compare:
  - `has_postgrad` → `{shortUni(postgrad_university)} ({shortDegree(postgrad_degree)}) • {shortUni(undergrad_university)} ({shortDegree(undergrad_degree)})` with graceful per-field degradation
  - else → `{undergrad_university} - {undergrad_degree}` (or just the university when no degree stored — legacy rows render exactly as today)
  - plus the secondary-school line.

## 4. Browse card — `public-tutor-card.tsx`
- Primary credential chain becomes `academic_headline ?? undergrad_university ?? secondary_school ?? fallback` (keeps the bold exam/headline line; the issue's "below exam badge" = below this line).
- Replace the plain `supportingCredentials` `<p>`s (lines 267–274) with up to 2 icon rows: GraduationCap + degree line, School + secondary school — each single-line with `truncate` (ellipsis), capping education at 2 fixed-height lines so grid cards stay symmetric.

## 5. Profile page — `src/routes/tutors.$tutorCode.tsx` (header block, lines 520–530)
Labeled rows with lucide icons, i18n labels:
- `academic_headline` (unchanged, first)
- `🎓 Postgraduate: {postgrad_university} - {postgrad_degree}` (only when `has_postgrad`)
- `🎓 Undergraduate: {undergrad_university} - {undergrad_degree}`
- `🏫 Secondary School: {secondary_school}`
New keys in `en.json` + `zh-HK.json`: `profile.education_postgraduate` / `education_undergraduate` / `education_secondary` (zh-HK: 研究院 / 學士 / 中學).

## 6. Compare dialog — `compare-tutors.tsx` (lines 113–129)
Swap the raw 2-value slice for the same `getTutorEducationLines` rows so all three surfaces stay consistent.

## 7. Admin tutor editor — `TutorEditor.tsx` + `_authenticated.admin.tutors.tsx`
- Zod `tutorFormSchema`: rename `university` → `undergrad_university`; add `undergrad_degree`, `undergrad_graduation_year` (max 40), `has_postgrad: z.boolean()`, `postgrad_university`, `postgrad_degree` (max 120); update `emptyTutorForm`, `tutorToFormData`, `formDataToPayload`.
- UI in the education grid: "Undergraduate University", "Undergraduate Degree", "Graduation Year" inputs + shadcn Checkbox "Postgraduate / Master's degree" conditionally revealing "Postgraduate University" and "Postgraduate Degree" inputs. Card preview (line ~2194) picks up the new card markup automatically.
- AI autofill (`autofill.functions.ts` + merge in TutorEditor): rename the university field references (schema fields, prompt, select cols).
- Admin tutors table CSV columns (route lines 391–393): "Undergraduate university" / "Undergraduate degree" / "Postgraduate".
- Publish validation (≥1 of headline/university/secondary) keeps working with the renamed column.

## 8. Intake form (/join) — `tutor-application.schema.ts` + `ApplicationForm.tsx`
- Schema: `hasPostgrad: z.boolean().default(false)`, `postgradUniversity`, `postgradDegree` (max 200, optional); `superRefine` requires both when `hasPostgrad`; `buildAnswerRows` adds "Postgraduate university" / "Postgraduate qualification" rows.
- Form (step 2, non-professional path, after Degree/Programme): checkbox "I hold or am pursuing a Master's / Postgraduate / Dual Degree" revealing "Postgraduate University / Institution" + "Postgraduate Degree / Qualification" inputs (reuse the countryOther/statusOther expandable pattern). Add to `ApplicationBaseState`, initial state, `validateCurrentStep`, `FIELD_LABELS`, and `submitForm` payload. Draft persistence is automatic via the base-state spread.
- Admin review page `_authenticated.admin.join-requests.tsx`: add the two new labels to `SECTION_LABELS.academic`.

## 9. Sweep
Grep `src/` for remaining `.university` / `university` column references and rename any touched by the DB column change (leaving /join JSONB keys, historical `scripts/tutor-import/sql`, and marketing copy alone).

## 10. Verification & delivery
- `npx tsc --noEmit`; targeted `npx eslint --fix` then lint on each touched file; `npm run check:i18n`; `npm run build`.
- Apply migration to prod Supabase via MCP; commit `Implement multi-degree support (undergrad + postgrad) Fixes #107`, push, and close issue #107 with a summary comment (repo pattern from #106/#109). No dependency changes, so `bun.lock` is untouched.
- Out of scope (not requested in the issue): tutor self-serve editing of degrees in Settings; AI autofill of the new degree fields; application→tutors auto-copy on acceptance (still manual via admin editor).