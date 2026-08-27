# Tutor profile refinements + admin form cleanup

## 1. Optional paper-level scores (Paper 1 / 2 / 3)

- In the admin exam-results editor, each subject row gets an optional "Paper scores" area: up to three small optional inputs (Paper 1, Paper 2, Paper 3). Blank ones are ignored.
- Stored inside the existing `exam_results` JSON on each subject entry as an optional `papers` array (`{ label, score }`), so no new database column is needed.
- On the public profile, papers show under the subject only when the admin filled them in, e.g. `Geography HL — Grade 7 (P1 7 · P2 6)`.

## 2. Profile page layout changes

- Remove the large bordered rectangle wrapping the whole detail area; sections become plain stacked blocks separated by generous spacing (no outer card, no border-bottom rows).
- Remove the grey vertical rules (`border-l`) in front of every line across Subjects Taught, Achievements, and Lesson Format rows.
- Core Academic Breakdown keeps the earlier styling feel: exam-system label, subject with its grade in brand teal, plus the new paper scores when present.

## 3. Subjects Taught formatting

- Render each subject as `IBDP: Geography (HL)` — exam-system prefix, subject name, level suffix.
- Level suffix appears only for HL subjects. SL subjects render with no suffix (`IBDP: Economics`). Non-IB systems just show `System: Subject`.
- Subject names that already carry "HL"/"SL" (as IB subjects in the picker do) get the level parsed out of the name so it is not duplicated.

## 4. Admin tutor panel alignment

Trim the form so it only collects what the profile and cards actually render:

- Keep: photo, tutor code, headline, university, highschool, target students, subjects, exam results (+ papers), achievements, IA/EE/TOK support & notes, qualifications summary, languages, district, lesson mode, gender, hourly rate, badge, published toggle, experience years / teaching since.
- Remove from the form: `bio` and `education` (structured education rows) — neither appears anywhere on the public profile any more; `academic_summary` is only surfaced on the tutor card, so it stays unless you want it gone too.

## 5. Database columns no longer used (safe to drop)

Confirmed by searching the codebase — nothing outside the generated types file references these:

- `tutors.intro_video_url`
- `tutors.weekly_rating`
- `tutors.weekly_score`
- `tutors.rating`
- `tutors.review_count`

Used only by the admin form and nothing public (drop only if you also want the form fields gone):

- `tutors.bio`
- `tutors.education`

I will not run a migration in this change — I will list them, and drop them in a follow-up once you confirm.

## Technical notes

- Files touched: `src/routes/tutors.$tutorCode.tsx`, `src/routes/_authenticated.admin.tutors.tsx`, `src/features/tutors/examSystems.ts` (paper types + normalisation), `src/features/tutors/tutor-display.ts` (system-prefixed subject label with HL-only suffix).
- Paper scores stay inside the existing `exam_results` jsonb, and normalisation stays backward compatible with entries that have no `papers` key.
