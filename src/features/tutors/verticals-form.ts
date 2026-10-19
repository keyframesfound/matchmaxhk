import { KINDERGARTEN_TOPICS, TARGET_TEACHING_LEVELS, type TargetTeachingLevel } from "./verticals";

/**
 * Issue #190 — pure list helpers shared by the admin TutorEditor and the
 * owner "My tutor profile" editor. Kept free of React/i18n so vitest can
 * cover them (tests/tutors/verticals-display.test.ts).
 */

/** Same 10-value cap the target-student tag editors always applied. */
export const MAX_TARGET_STUDENTS = 10;

/** Dedupe case-insensitively (first spelling wins), trim, cap. */
export function dedupeCapStrings(values: string[], cap: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= cap) break;
  }
  return out;
}

/**
 * Tick/untick one canonical level inside target_students while PRESERVING
 * pre-existing non-canonical strings (IBDP, HKDSE, Adult learners…).
 * Matching is case-insensitive so "IBDP"/"ibdp" collapse to one entry and a
 * canonical level replaces any casing variant of itself.
 */
export function toggleTargetLevel(
  existing: string[],
  level: TargetTeachingLevel,
  checked: boolean,
): string[] {
  const rest = existing.filter(
    (value) => typeof value === "string" && value.trim().toLowerCase() !== level.toLowerCase(),
  );
  return checked
    ? dedupeCapStrings([...rest, level], MAX_TARGET_STUDENTS)
    : dedupeCapStrings(rest, MAX_TARGET_STUDENTS);
}

/** Canonical levels currently present in target_students (option order). */
export function selectedTargetLevels(targetStudents: string[]): TargetTeachingLevel[] {
  const present = new Set(
    targetStudents
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim().toLowerCase()),
  );
  return TARGET_TEACHING_LEVELS.filter((level) => present.has(level.toLowerCase()));
}

/**
 * Add/remove one canonical Kindergarten topic inside tutors.subjects (K
 * topics are tags, not a column). Case-insensitive so a stored variant of
 * the same topic doesn't duplicate.
 */
export function toggleKindergartenTopic(
  subjects: string[],
  topic: string,
  checked: boolean,
): string[] {
  const rest = subjects.filter(
    (value) => typeof value === "string" && value.trim().toLowerCase() !== topic.toLowerCase(),
  );
  return checked ? [...rest, topic] : rest;
}

/** Canonical K topics present in subjects (option order). */
export function kindergartenTopicsInSubjects(subjects: string[]): string[] {
  const present = new Set(
    subjects
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim().toLowerCase()),
  );
  return KINDERGARTEN_TOPICS.filter((topic) => present.has(topic.toLowerCase()));
}

/** Draft row for the course-grade pair editor. */
export type CourseGradeRow = { course: string; grade: string };

/** course_specific_grades object → ordered draft rows for editing. */
export function courseGradeRows(
  grades: Record<string, string> | null | undefined,
): CourseGradeRow[] {
  if (!grades || typeof grades !== "object" || Array.isArray(grades)) return [];
  return Object.entries(grades).map(([course, grade]) => ({
    course,
    grade: typeof grade === "string" ? grade : String(grade ?? ""),
  }));
}

/** Draft rows → course_specific_grades object (drops blanks, keeps order). */
export function courseGradeRowsToRecord(rows: CourseGradeRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const course = row.course.trim().slice(0, 40);
    const grade = row.grade.trim();
    if (!course || !grade) continue;
    if (Object.keys(out).some((key) => key.toLowerCase() === course.toLowerCase())) continue;
    out[course] = grade;
  }
  return out;
}

/** "ECON1210 — A+" — the public profile line format. */
export function formatCourseGradeLine(row: CourseGradeRow): string {
  return `${row.course} — ${row.grade}`;
}
