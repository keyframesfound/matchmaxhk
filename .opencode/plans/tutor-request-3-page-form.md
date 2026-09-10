# Tutor Request Form — 3-Page Wizard Architecture

Status: APPROVED (user confirmed all four open questions). Migration already applied to remote Supabase.

## Confirmed decisions

1. **DB**: new typed columns on `tutoring_cases` (migration `expand_case_request_fields` — DONE).
2. **Legacy fields dropped from form**: lessons/week, lesson length, budget min, tutor gender, start timing (DB defaults 1x/week, 60 min, `any`, null apply).
3. **Specific Component**: always visible on Path A once a curriculum is selected, with a `None` option; disabled until curriculum chosen.
4. **Year dropdown**: reuse existing `LEVEL_OPTIONS` (Primary / Junior secondary / Senior secondary / University / Other).

## Applied migration (supabase/migrations equivalent: applied via MCP)

`ALTER TABLE public.tutoring_cases ADD COLUMN IF NOT EXISTS`
- `contact_email text`
- `requester_type text` — 'parent' | 'student'
- `support_type text` — 'subject_tutoring' | 'admissions'
- `specific_component text`
- `target_pathway text` — 'UCAS / UK' | 'US Admissions' | 'HK JUPAS' | 'Tests'
- `target_school text`
- `interview_test text` — 'Medicine MMI' | 'Oxbridge' | 'IELTS' | 'SAT' | 'UCAT' | 'ISAT'
- `school_type text`
- `tutor_background text` — 'uni_student' | 'official_examiner' | 'any'

Security advisors re-run post-migration: no new findings (columns inherit existing table RLS policies).

## Remaining code changes

### 1. `src/features/tutors/subjects.ts`

- Add `"Primary Science"` and `"Phonics"` to the `DEFAULT_SUBJECT_OPTIONS` literal list (keeps case subjects tag-compatible with tutor subject tags).
- Export two new arrays (sorted):
  - `LOCAL_PRIMARY_SUBJECTS = ["Primary Chinese","Primary English","Primary Mathematics","General Studies","Phonics"]`
  - `INTL_PRIMARY_SUBJECTS = ["Primary English","Primary Mathematics","Primary Science","Phonics"]`

### 2. `src/features/cases/case-options.ts`

Add constants (keep `LEVEL_OPTIONS`, `EXAM_SYSTEM_OPTIONS` for admin edit dialog):

```ts
export const REQUESTER_TYPE_OPTIONS = [
  { value: "parent", label: "Parent" },
  { value: "student", label: "Student" },
];

export const SUPPORT_TYPE_OPTIONS = [
  { value: "subject_tutoring", label: "Subject Tutoring & School Exams" },
  { value: "admissions", label: "University Admissions & Standardized Tests (SAT, IELTS, UCAT, ISAT)" },
];

export const CURRICULUM_OPTIONS = [
  { value: "IB", label: "IBDP" },
  { value: "DSE", label: "HKDSE" },
  { value: "A-Level", label: "A-Level" },
  { value: "IGCSE", label: "IGCSE" },
  { value: "Local Primary", label: "Local Primary" },
  { value: "Int'l Primary", label: "Int'l Primary" },
];
// Reuses existing exam_system values (IB/DSE/A-Level/IGCSE) so board
// grouping + admin edit keep working; two new values for primary tracks.

export const CURRICULUM_COMPONENTS: Record<string, string[]> = {
  IB: ["IA", "EE", "TOK"],
  "Local Primary": ["Phonics"],
  "Int'l Primary": ["Phonics"],
};
// Component dropdown options = ["None", ...(CURRICULUM_COMPONENTS[curriculum] ?? [])]
// Always rendered on Path A (per user decision), disabled until curriculum chosen.

export const INSTRUCTION_LANGUAGE_OPTIONS = [
  { value: "english_only", label: "English" },
  { value: "cantonese", label: "Cantonese" },
  { value: "mandarin", label: "Mandarin" },
  { value: "bilingual", label: "Bilingual" },
  { value: "any", label: "No preference" },
];

export const DELIVERY_MODE_OPTIONS = [
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },   // maps to DB 'in_person'
  { value: "both", label: "Both" },         // maps to DB 'either'
  { value: "no_pref", label: "No preference" }, // maps to DB 'either'
];
// MTR shown when value !== "online" (Offline, Both, No Preference).

export const TUTOR_BACKGROUND_OPTIONS = [
  { value: "uni_student", label: "University student" },
  { value: "official_examiner", label: "Official examiner" },
  { value: "any", label: "No preference" },
];

export const TARGET_PATHWAY_OPTIONS = [
  { value: "ucas_uk", label: "UCAS / UK" },
  { value: "us_admissions", label: "US Admissions" },
  { value: "hk_jupas", label: "HK JUPAS" },
  { value: "tests", label: "Tests" },
];

export const INTERVIEW_TEST_OPTIONS = [
  "Medicine MMI", "Oxbridge", "IELTS", "SAT", "UCAT", "ISAT",
];

export const TARGET_SCHOOL_OPTIONS = [
  // searchable seed list, allowCustom lets parents type anything
  "HKU","CUHK","HKUST","PolyU","CityU","HKBU","Lingnan","EdUHK",
  "Oxford","Cambridge","Imperial","LSE","UCL","Edinburgh","Manchester",
  "Harvard","Yale","Princeton","Stanford","MIT","UPenn","Columbia",
];
```

Add a resolver (uses `LOCAL_PRIMARY_SUBJECTS` / `INTL_PRIMARY_SUBJECTS`):

```ts
import { LOCAL_PRIMARY_SUBJECTS, INTL_PRIMARY_SUBJECTS } from "@/features/tutors/subjects";

export function getSubjectOptionsForCurriculum(curriculum: string): string[] {
  switch (curriculum) {
    case "Local Primary": return [...LOCAL_PRIMARY_SUBJECTS];
    case "Int'l Primary": return [...INTL_PRIMARY_SUBJECTS];
    default: return getSubjectOptionsForCategory(curriculum); // existing helper
  }
}
```

### 3. `src/features/cases/CaseRequestForm.tsx` — rewrite as 3-step wizard

State: `step: 1|2|3`, `FormState` (replaces old):

```
requesterType, parentName, contactPhone, contactEmail, supportType,
curriculum, subject1, subject2, specificComponent, instructionLanguage,
year, schoolName, schoolType,
targetPathway, targetSchool, interviewTest,
deliveryMode, district, budgetMax, tutorBackground, notes
```

- `stepLabels = ["Contact", supportType === "admissions" ? "Admissions" : "Tutoring", "Logistics"]`; numbered progress header (1-2-3 circles + labels, current highlighted).
- **Per-step validation** on Next: step1 → requesterType, parentName, contactPhone (PHONE_REGEX), contactEmail (email regex) required; step2 → path A: curriculum, subject1, instructionLanguage; path B: targetPathway, interviewTest. Errors reuse `invalidInputClassName` / `RequiredFlag` / aria-invalid pattern.
- **Curriculum locking**: `disabled={!form.curriculum}` on Subjects + Component SearchableSelects; subject options from `getSubjectOptionsForCurriculum(form.curriculum)` (empty array when none selected).
- **State reset**: `handleCurriculumChange` sets `{ curriculum, subject1: "", subject2: "", specificComponent: "" }` — instant reset per spec.
- **Component options**: `["None", ...(CURRICULUM_COMPONENTS[curriculum] ?? [])]`.
- **Page 3**: Delivery Mode select; `{form.deliveryMode !== "online" && form.deliveryMode !== "" && <MtrStationSelect …/>}` (required when rendered); Max budget `Input` numeric-only (required); Tutor Background optional + directly below it:

```tsx
<p className="mt-1 text-xs text-muted-foreground">
  Note: Official Examiners typically command double the hourly rate of University Students
</p>
```

- Submit payload (new shape), draft key bumped to `"case-request-v3"`, honeypot + elapsedMs kept, success screen unchanged.
- Removed fields (frequency/length/gender/start/budgetMin) deleted from FormState + JSX.

### 4. `src/lib/cases.functions.ts`

- Zod `CaseRequestInput`: replace old fields with the new shape; email via `z.string().trim().email()`; `superRefine` for supportType-conditional requirements (path A: curriculum+subject+language; path B: pathway+test) and `district` required when `mode !== "online"`.
- Mode mapping on submit: `offline→in_person`, `both|no_pref→either`, `online→online`.
- Insert row: add `contact_email, requester_type, support_type, specific_component, target_pathway, target_school, interview_test, school_type, tutor_background`; `budget_min: null`, sessions/length defaults unchanged.
- Build standardized `tags` for Profile Mapping (deduped, trimmed): specific component (skip "None"), tutor background label ("University student"/"Official examiner"), interview test label, target pathway label. These mirror tutor-profile tag vocabulary so Case Cards line up with tutor "Subjects Taught" / "Achievements and Experiences".
- `PublicCaseBoardItem` += `tags: string[]`; `PUBLIC_CASE_COLUMNS` += `tags` (NOT contact_email — stays private).

### 5. `src/routes/tutor-requests.$caseCode.tsx`

- Render `item.tags` as `Badge` chips under the meta row (guard for empty).
- Extend `preferences` list with instruction language / tutor background / pathway / test when present (all nullable-safe for legacy rows). Note: `language_of_instruction` is a column on the table but not in PUBLIC_CASE_COLUMNS today — add it to the select + type + mapper (non-identifying field).

### 6. Not changing

- Admin `CaseEditDialog`/`CaseDetailView` (still edits core listing fields; new columns visible in DB for staff).
- Board rows (`tutor-requests.index.tsx`), `display.ts`, dependencies / `bun.lock`.

### 7. Verification

- `npm run lint` + typecheck (`npx tsc --noEmit` or repo script).
- Dev-server smoke test: wizard steps, curriculum locking + reset, conditional MTR, submission → row + tags, case card render.
