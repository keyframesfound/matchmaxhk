## Changes to Admin Tutor Form — Exam Results & UI Stability

### 1. Exam Results: multi-subject entry per row
Currently each exam-result row is one system → one subject → one grade. Rework each row so an admin picks an **Exam system** once, then adds **multiple subject+grade pairs** under it (e.g. one IB row with 6 subjects, each with its own grade).

Row shape becomes:
```text
[ Exam system ▾ ]  [ + Add subject ]
  ├─ Subject ▾   Grade ▾   [x]
  ├─ Subject ▾   Grade ▾   [x]
  └─ ...
[ Remove exam system ]
```
Stored as `{ system, subjects: [{ subject, grade }] }[]` in the existing `exam_results` JSONB column (migration-free: just a shape change; old single-entry rows will be normalized on load into the new shape).

### 2. Remove the Year field
Drop the "Year" input from every exam result entry — both from the form and from the public profile table on `tutors.$tutorCode.tsx`.

### 3. Scrollable dropdowns + stable layout
Fix the shifting UI when long option lists or chips render:

- `SearchableSelect` popover: cap height and make the list scroll (`max-h-72 overflow-y-auto` on the Command list, and set the Popover content to a fixed width matching the trigger via `--radix-popover-trigger-width`, `align="start"`).
- Multi-select subject dropdown: same scrollable cap; render selected chips inside a min-height container so adding/removing chips doesn't jump the form height.
- Exam-results section: give each row a stable grid (`grid-cols-[1fr_1fr_auto]`), so grade values of different lengths don't resize neighbors. Wrap the whole form in a max-width container with `overflow-visible` but predictable column widths, and prevent the right-hand admin panel from expanding when values change.

### Files touched
- `src/routes/_authenticated.admin.tutors.tsx` — exam-results UI (multi-subject rows, no year), form state shape, load/save normalization, layout tightening.
- `src/features/tutors/queries.ts` — `ExamResult` type updated to `{ system: string; subjects: { subject: string; grade: string }[] }`.
- `src/routes/tutors.$tutorCode.tsx` — display grouped by system, no Year column; normalize legacy entries at read time.
- `src/components/ui/searchable-select.tsx` — enforce trigger-width popover + scrollable list.

### Backward compatibility
No DB migration. On load, any legacy `{system, subject, grade, year}` entries are grouped by `system` into the new shape; on save we write only the new shape.
