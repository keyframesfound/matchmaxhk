/**
 * Issue #190, Kindergarten & University tutoring verticals: vocabulary and
 * matching helpers shared by the tutor application form, the tutor profile
 * editors, the admin TutorEditor, the case request form, tutor search and
 * the public tutor card.
 *
 * Stored vocabularies are DATA (tutors.target_students, tutors.subjects,
 * tutoring_cases.academic_tier / kindergarten_focus), renaming an entry
 * here without a data migration would orphan stored rows. Display labels
 * localize through verticals-labels.ts.
 */

// --- Target teaching level (tutors.target_students canonical values) ---

export const TARGET_TEACHING_LEVELS = [
  "Kindergarten",
  "Primary",
  "Secondary",
  "University",
] as const;

export type TargetTeachingLevel = (typeof TARGET_TEACHING_LEVELS)[number];

/** Tolerant read: canonical values only, deduped, in option order. */
export function normalizeTargetLevels(raw: unknown): TargetTeachingLevel[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(TARGET_TEACHING_LEVELS);
  const picked = new Set<string>(
    raw.filter((value): value is string => typeof value === "string" && allowed.has(value)),
  );
  return TARGET_TEACHING_LEVELS.filter((option) => picked.has(option));
}

// --- Kindergarten topics (canonical tags stored in tutors.subjects) ---

export const KINDERGARTEN_FOUNDATION_TOPICS = [
  "Kindergarten Phonics",
  "Kindergarten English Reading",
  "Kindergarten English Writing",
  "Kindergarten Mandarin Immersion",
  "Kindergarten Basic Mathematics",
] as const;

export const KINDERGARTEN_P1_INTERVIEW_TOPICS = [
  "P1 Interview, Communication & Etiquette",
  "P1 Interview, Group Play Observation",
  "P1 Interview, Storytelling & Role-play",
  "P1 Interview, General Knowledge",
] as const;

export const KINDERGARTEN_TOPICS = [
  ...KINDERGARTEN_FOUNDATION_TOPICS,
  ...KINDERGARTEN_P1_INTERVIEW_TOPICS,
] as const;

export type KindergartenTopic = (typeof KINDERGARTEN_TOPICS)[number];

/** Tolerant read: canonical K topics only, deduped, in option order. */
export function normalizeKindergartenTopics(raw: unknown): KindergartenTopic[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(KINDERGARTEN_TOPICS);
  const picked = new Set<string>(
    raw.filter((value): value is string => typeof value === "string" && allowed.has(value)),
  );
  return KINDERGARTEN_TOPICS.filter((option) => picked.has(option));
}

/** K-tab toggle buckets: which canonical topics each toggle matches. */
export const KINDERGARTEN_FILTER_GROUPS = {
  phonics: ["Kindergarten Phonics"],
  mandarin: ["Kindergarten Mandarin Immersion"],
  interviewPrep: [...KINDERGARTEN_P1_INTERVIEW_TOPICS],
} as const;

export type KindergartenFilterKey = keyof typeof KINDERGARTEN_FILTER_GROUPS;

/** True when the tutor's subjects[] cover every active K toggle (AND). */
export function matchesKindergartenFilter(
  subjects: string[],
  active: Partial<Record<KindergartenFilterKey, boolean>>,
): boolean {
  const keys = (Object.keys(active) as KindergartenFilterKey[]).filter((key) => active[key]);
  if (keys.length === 0) return true;
  const haystack = new Set(subjects.map((s) => s.trim().toLowerCase()));
  return keys.every((key) =>
    KINDERGARTEN_FILTER_GROUPS[key].some((topic) => haystack.has(topic.toLowerCase())),
  );
}

// --- University vertical (tutors.university_* self-reported fields) ---

/** Suggestion list for university pickers: HK 8 + HKMU + popular overseas. */
export const UNIVERSITY_SUGGESTIONS = [
  "HKU",
  "CUHK",
  "HKUST",
  "PolyU",
  "CityU",
  "HKBU",
  "Lingnan University",
  "EdUHK",
  "HKMU",
  "University College London",
  "Imperial College London",
  "King's College London",
  "Durham University",
  "National University of Singapore",
  "Nanyang Technological University",
  "University of Melbourne",
  "University of Toronto",
] as const;

export const FIELDS_OF_STUDY = [
  "Business & Management",
  "Engineering",
  "Computer Science & Data",
  "Medicine & Health",
  "Law",
  "Science",
  "Mathematics",
  "Social Sciences",
  "Humanities & Languages",
  "Education",
  "Arts & Design",
  "Architecture",
  "Other",
] as const;

export type FieldOfStudy = (typeof FIELDS_OF_STUDY)[number];

export const YEARS_OF_STUDY = [
  "Year 1",
  "Year 2",
  "Year 3",
  "Year 4",
  "Postgraduate",
  "Alumni / Graduate",
] as const;

export type YearOfStudy = (typeof YEARS_OF_STUDY)[number];

export const COURSE_GRADE_OPTIONS = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "Pass"] as const;

export type CourseGrade = (typeof COURSE_GRADE_OPTIONS)[number];

export const MAX_UNIVERSITY_COURSES = 12;
export const MAX_UNIVERSITY_GPA = 4.3;

export function normalizeUniversityYear(raw: unknown): YearOfStudy | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return (YEARS_OF_STUDY as readonly string[]).includes(value) ? (value as YearOfStudy) : null;
}

/** Free decimal 0–4.3, 2dp, else null. Blank / junk input → null. */
export function normalizeUniversityGpa(raw: unknown): number | null {
  if (typeof raw === "string" && raw.trim() === "") return null;
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(value) || value < 0 || value > MAX_UNIVERSITY_GPA) return null;
  return Math.round(value * 100) / 100;
}

/**
 * Issue #395: editor-save guard shared with normalizeUniversityGpa, blank is
 * allowed, but non-blank text outside 0–4.3 must BLOCK the save with
 * `verticals.editor_gpa_invalid` (admin TutorEditor / owner profile / join),
 * never silently normalize to null on the way to the DB.
 */
export function isInvalidUniversityGpaText(raw: string): boolean {
  return raw.trim() !== "" && normalizeUniversityGpa(raw) === null;
}

/** Course-code/name tags: trimmed, ≤40 chars, deduped, capped. */
export function normalizeUniversityCourses(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const value = entry.trim().slice(0, 40);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= MAX_UNIVERSITY_COURSES) break;
  }
  return out;
}

export type CourseGradeEntry = { course: string; grade: CourseGrade };

/**
 * Course-specific grades: canonical grade vocabulary, one entry per course
 * code (first wins on duplicates after case-collapsing). Stored as a jsonb
 * object map course -> grade.
 */
export function normalizeCourseGrades(raw: unknown): Record<string, CourseGrade> {
  // Accepts either the form shape (array of {course, grade} pairs) or the
  // stored shape (a jsonb object map course -> grade).
  let entries: unknown[];
  if (Array.isArray(raw)) {
    entries = raw;
  } else if (raw && typeof raw === "object") {
    entries = Object.entries(raw as Record<string, unknown>).map(([course, grade]) => ({
      course,
      grade,
    }));
  } else {
    return {};
  }
  const allowed = new Set<string>(COURSE_GRADE_OPTIONS);
  const out: Record<string, CourseGrade> = {};
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const course = String((entry as { course?: unknown }).course ?? "")
      .trim()
      .slice(0, 40);
    const grade = String((entry as { grade?: unknown }).grade ?? "").trim();
    if (!course || !allowed.has(grade)) continue;
    const key = course.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out[course] = grade as CourseGrade;
  }
  return out;
}

/** Course-code strings for the search haystack (courses taught + graded). */
export function universityCourseTexts(tutor: {
  university_courses?: unknown;
  course_specific_grades?: unknown;
}): string[] {
  const courses = Array.isArray(tutor.university_courses)
    ? (tutor.university_courses as unknown[]).filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const graded = tutor.course_specific_grades as Record<string, unknown> | null | undefined;
  const gradeKeys =
    graded && typeof graded === "object" && !Array.isArray(graded) ? Object.keys(graded) : [];
  return [...courses, ...gradeKeys];
}

// --- Academic tier ---

export const ACADEMIC_TIERS = ["kindergarten", "primary_secondary", "university"] as const;

export type AcademicTier = (typeof ACADEMIC_TIERS)[number];

export function normalizeAcademicTier(raw: unknown): AcademicTier | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  return (ACADEMIC_TIERS as readonly string[]).includes(value) ? (value as AcademicTier) : null;
}

/**
 * Tier → canonical target_students marker used on tutor-side forms.
 * Primary and Secondary share the "Primary & Secondary" tab but stay
 * separate stored levels.
 */
export function tierToTargetLevel(tier: AcademicTier): TargetTeachingLevel | null {
  switch (tier) {
    case "kindergarten":
      return "Kindergarten";
    case "university":
      return "University";
    default:
      return null;
  }
}

/**
 * Which search tabs a tutor belongs to, from target_students.
 *
 * - "Kindergarten" / "University" are explicit opt-ins.
 * - Primary & Secondary is the default bucket: it catches the canonical
 *   Primary/Secondary levels, every legacy curriculum string already stored
 *   in target_students (IBDP, IGCSE, A-Level, HKDSE, AP, MYP, GCSE, Junior
 *   / Senior Secondary…), any other free-text audience value, and the
 *   empty array (Ryan: tutors with no tier data show under the default
 *   tab). Only an exclusively-University or exclusively-Kindergarten tutor
 *   stays out of it.
 */
export function tutorTierMembership(targetStudents: string[]): Set<AcademicTier> {
  const values = Array.isArray(targetStudents)
    ? targetStudents.filter((value): value is string => typeof value === "string")
    : [];
  const tiers = new Set<AcademicTier>();
  if (values.includes("Kindergarten")) tiers.add("kindergarten");
  if (values.includes("University")) tiers.add("university");
  const hasNonVerticalMarker = values.some(
    (value) => value !== "Kindergarten" && value !== "University",
  );
  if (values.length === 0 || hasNonVerticalMarker) tiers.add("primary_secondary");
  return tiers;
}

/** Legacy case rows derive their tier from student_level at read time. */
export function caseAcademicTier(
  stored: unknown,
  studentLevel?: string | null,
): AcademicTier | null {
  const explicit = normalizeAcademicTier(stored);
  if (explicit) return explicit;
  const level = (studentLevel ?? "").trim().toLowerCase();
  if (level === "university") return "university";
  if (level === "kindergarten") return "kindergarten";
  return null;
}
