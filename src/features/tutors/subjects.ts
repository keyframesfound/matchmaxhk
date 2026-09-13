import { EXAM_SYSTEMS } from "./examSystems";

// --- Primary School (local + international school subjects) ---

// Legacy per-track lists kept for old case rows ("Local Primary" /
// "Int'l Primary" curricula in historical tutoring_cases).
export const LOCAL_PRIMARY_SUBJECTS = [
  "Primary Chinese",
  "Primary English",
  "Primary Mathematics",
  "General Studies",
  "Phonics",
].sort((a, b) => a.localeCompare(b));

export const INTL_PRIMARY_SUBJECTS = [
  "Primary English",
  "Primary Mathematics",
  "Primary Science",
  "Phonics",
].sort((a, b) => a.localeCompare(b));

// One "Primary School" pool covering both local and international schools.
export const PRIMARY_SCHOOL_SUBJECTS = Array.from(
  new Set([...LOCAL_PRIMARY_SUBJECTS, ...INTL_PRIMARY_SUBJECTS, "Primary Music", "Primary Art"]),
).sort((a, b) => a.localeCompare(b));

// Junior secondary (Year 7–9 / S1–S3): the point where sciences start
// splitting into separate subjects. Plain names align with senior-level
// subject tags, so tutors covering both levels match either.
export const JUNIOR_SECONDARY_SUBJECTS = [
  "Chinese",
  "English",
  "Mathematics",
  "Science",
  "Physics",
  "Chemistry",
  "Biology",
  "Geography",
  "History",
  "Chinese History",
  "Life & Society",
  "Putonghua",
  "Music",
  "Visual Arts",
  "Computer Science",
  "Design & Technology",
].sort((a, b) => a.localeCompare(b));

// University admissions & standardized tests.
export const ADMISSIONS_TEST_SUBJECTS = [
  "IELTS",
  "SAT",
  "UCAT",
  "ISAT",
  "TOEFL",
  "Personal Statement",
  "University Interview Prep",
  "Oxbridge Interview",
  "Medicine Interview (MMI)",
].sort((a, b) => a.localeCompare(b));

// Canonical teachable-subject pool across every curriculum. Exam systems
// contribute their subject lists (qualification-only systems — IELTS, ISAT,
// UCAT, SAT — are excluded: their "subjects" are score entries, and those
// tests enter the pool via ADMISSIONS_TEST_SUBJECTS instead). The curated
// pools above cover primary, junior-secondary and admissions.
export const DEFAULT_SUBJECT_OPTIONS: string[] = (() => {
  const set = new Set<string>();
  for (const sys of EXAM_SYSTEMS) {
    if (sys.qualificationsOnly) continue;
    for (const s of sys.subjects) set.add(s);
  }
  for (const s of [
    "Art",
    "Biology",
    "Chemistry",
    "Chinese",
    "Computer Science",
    "Economics",
    "English",
    "Geography",
    "History",
    "Mathematics",
    "Music",
    "Physics",
    "Putonghua",
    "Science",
    "Visual Arts",
  ])
    set.add(s);
  for (const s of PRIMARY_SCHOOL_SUBJECTS) set.add(s);
  for (const s of JUNIOR_SECONDARY_SUBJECTS) set.add(s);
  for (const s of ADMISSIONS_TEST_SUBJECTS) set.add(s);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
})();

const systemSubjects = (id: string): string[] =>
  EXAM_SYSTEMS.find((s) => s.id === id)?.subjects ?? [];

/**
 * Curriculum category -> subject pool, so subject dropdowns narrow to the
 * selected curriculum (e.g. picking "IB" only lists IB subjects, "Primary
 * School" only primary subjects). Keys are lowercase category values and
 * aliases; "Admissions" and the standalone test names share the admissions
 * pool. Unmapped categories fall back to the full pool.
 */
const CURRICULUM_SUBJECT_MAP: Record<string, string[]> = {
  ib: systemSubjects("ib"),
  ibdp: systemSubjects("ib"),
  dse: systemSubjects("dse"),
  hkdse: systemSubjects("dse"),
  igcse: systemSubjects("igcse"),
  gcse: systemSubjects("igcse"),
  "a-level": systemSubjects("alevel"),
  alevel: systemSubjects("alevel"),
  ap: systemSubjects("ap"),
  primary: PRIMARY_SCHOOL_SUBJECTS,
  "primary school": PRIMARY_SCHOOL_SUBJECTS,
  "local primary": LOCAL_PRIMARY_SUBJECTS,
  "int'l primary": INTL_PRIMARY_SUBJECTS,
  "junior secondary": JUNIOR_SECONDARY_SUBJECTS,
  admissions: ADMISSIONS_TEST_SUBJECTS,
  "admissions & standardized tests": ADMISSIONS_TEST_SUBJECTS,
  "admissions and standardized tests": ADMISSIONS_TEST_SUBJECTS,
  ielts: ADMISSIONS_TEST_SUBJECTS,
  sat: ADMISSIONS_TEST_SUBJECTS,
  isat: ADMISSIONS_TEST_SUBJECTS,
  ucat: ADMISSIONS_TEST_SUBJECTS,
};

export function getSubjectOptionsForCategory(category: string | undefined): string[] {
  const pool = CURRICULUM_SUBJECT_MAP[(category ?? "").trim().toLowerCase()];
  if (!pool) return DEFAULT_SUBJECT_OPTIONS;
  return [...pool];
}

/**
 * True when the tutor plausibly teaches the selected curriculum category.
 * Mapped categories match tutor `subjects` against that curriculum's subject
 * pool (with a contains-fallback for free-text tags like "IB Biology");
 * everything else (and tutors whose level labels say it, e.g. "Junior
 * Secondary" in target students) falls back to plain text matching.
 */
export function matchesCategoryFilter(
  category: string,
  subjects: string[],
  extraText: string[] = [],
): boolean {
  const normalized = category.trim().toLowerCase();
  if (!normalized) return true;
  const pool = CURRICULUM_SUBJECT_MAP[normalized];
  if (pool) {
    const matched = subjects.some((s) => {
      const key = s.trim().toLowerCase();
      if (!key) return false;
      if (pool.some((candidate) => candidate.toLowerCase() === key)) return true;
      return pool.some((candidate) => key.includes(candidate.toLowerCase()));
    });
    if (matched) return true;
    // Free-text tags can name the curriculum itself ("IB Biology",
    // "University admissions prep") — keep the plain text fallback.
    if (subjects.some((s) => s.toLowerCase().includes(normalized))) return true;
    return extraText.some((text) => text.toLowerCase().includes(normalized));
  }
  const source = [...subjects, ...extraText].join(" ").toLowerCase();
  return source.includes(normalized);
}

// Abbreviation stems so full-name subject picks match abbreviated exam-system
// tags (and vice versa): "Physics" matches "Phys HL", "Mathematics" matches
// "Math AA HL", "Computer Science" matches "CompSci", "Putonghua" matches
// "Mandarin", etc.
const SUBJECT_STEMS: Record<string, string[]> = {
  mathematics: ["math"],
  physics: ["phys"],
  chemistry: ["chem"],
  biology: ["bio"],
  economics: ["econ"],
  geography: ["geog"],
  history: ["hist"],
  psychology: ["psych"],
  philosophy: ["phil"],
  "computer science": ["compsci"],
  chinese: ["chin"],
  english: ["eng"],
  science: ["sci"],
  "visual arts": ["art"],
  putonghua: ["mandarin"],
  mandarin: ["putonghua"],
};

export function getSubjectMatchVariants(input: string): string[] {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return [];

  const variants = new Set<string>([normalized]);
  for (const stem of SUBJECT_STEMS[normalized] ?? []) variants.add(stem);

  const levelMatch = normalized.match(/^(.*?)(?:\s+|\b)(hl|sl)\s*$/);
  if (levelMatch) {
    const base = levelMatch[1].trim();
    if (base) {
      variants.add(base);
      variants.add(`${base} hl`);
      variants.add(`${base} sl`);
      for (const stem of SUBJECT_STEMS[base] ?? []) variants.add(stem);
    }
  } else if (normalized === "sl" || normalized === "hl") {
    variants.add(normalized === "sl" ? "hl" : "sl");
  }

  return Array.from(variants);
}

export function matchesSubjectQuery(subject: string, query: string): boolean {
  const normalizedSubject = subject.trim().toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return true;

  return getSubjectMatchVariants(normalizedQuery).some((variant) =>
    normalizedSubject.includes(variant),
  );
}
