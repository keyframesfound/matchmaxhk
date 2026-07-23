export type ExamSystemId = "ib" | "dse" | "alevel" | "igcse" | "ap" | "sat" | "other";

export type ExamSystem = {
  id: ExamSystemId;
  label: string;
  subjects: string[];
  /** If true, subject can be free text (used for "Other"). */
  freeSubject?: boolean;
  /**
   * Per-subject overrides for grade choices.
   * Example: SAT sections have numeric bands.
   */
  gradesFor?: (subject: string) => string[];
  grades: string[];
};

const IB_SUBJECTS = [
  // Group 1
  "English A Language & Literature", "English A Literature",
  "Chinese A Language & Literature", "Chinese A Literature",
  // Group 2
  "English B", "Chinese B", "French B", "Spanish B", "German B", "Japanese B",
  "Spanish ab initio",
  // Group 3
  "Business Management", "Economics", "Geography", "Global Politics", "History",
  "Philosophy", "Psychology", "Environmental Systems & Societies",
  // Group 4
  "Biology", "Chemistry", "Computer Science", "Design Technology", "Physics", "Sports Exercise & Health Science",
  // Group 5
  "Mathematics: Analysis & Approaches", "Mathematics: Applications & Interpretation",
  // Group 6
  "Visual Arts", "Music", "Theatre", "Film", "Dance",
  // Core
  "Theory of Knowledge", "Extended Essay",
];

const DSE_SUBJECTS = [
  "Chinese Language", "English Language", "Mathematics Compulsory Part",
  "Mathematics Extended Module 1 (M1)", "Mathematics Extended Module 2 (M2)",
  "Liberal Studies", "Citizenship and Social Development",
  "Biology", "Chemistry", "Physics", "Combined Science", "Integrated Science",
  "Economics", "BAFS (Accounting)", "BAFS (Business Management)",
  "Geography", "History", "Chinese History", "Tourism & Hospitality Studies",
  "ICT", "Design & Applied Technology", "Health Management & Social Care",
  "Visual Arts", "Music", "Physical Education",
  "Literature in English", "Chinese Literature",
  "French", "German", "Japanese", "Spanish", "Korean", "Hindi", "Urdu",
];

const ALEVEL_SUBJECTS = [
  "Mathematics", "Further Mathematics", "Statistics",
  "Physics", "Chemistry", "Biology", "Computer Science",
  "Economics", "Business", "Accounting", "Geography", "History",
  "Politics", "Psychology", "Sociology", "Law", "Philosophy",
  "English Language", "English Literature",
  "French", "Spanish", "German", "Mandarin Chinese", "Latin",
  "Art & Design", "Music", "Drama & Theatre", "Media Studies",
];

const IGCSE_SUBJECTS = [
  "Mathematics", "Additional Mathematics", "International Mathematics",
  "First Language English", "English as a Second Language", "English Literature",
  "First Language Chinese", "Chinese as a Second Language",
  "Biology", "Chemistry", "Physics", "Combined Science", "Coordinated Sciences",
  "Economics", "Business Studies", "Accounting", "Geography", "History", "Global Perspectives",
  "Computer Science", "ICT", "Design & Technology",
  "French", "Spanish", "German", "Mandarin Chinese",
  "Art & Design", "Music", "Drama", "Physical Education",
];

const AP_SUBJECTS = [
  "Calculus AB", "Calculus BC", "Statistics", "Precalculus",
  "Biology", "Chemistry", "Physics 1", "Physics 2", "Physics C: Mechanics", "Physics C: E&M", "Environmental Science",
  "Computer Science A", "Computer Science Principles",
  "Microeconomics", "Macroeconomics", "US Government & Politics", "Comparative Government & Politics",
  "US History", "World History", "European History", "Human Geography", "Psychology",
  "English Language & Composition", "English Literature & Composition",
  "Chinese Language & Culture", "Spanish Language & Culture", "French Language & Culture", "Japanese Language & Culture", "German Language & Culture", "Latin",
  "Art History", "Studio Art", "Music Theory",
];

const SAT_SUBJECTS = [
  "SAT (Total)",
  "SAT Evidence-Based Reading & Writing",
  "SAT Math",
  "SAT Essay (legacy)",
];

const IB_GRADES = ["7", "6", "5", "4", "3", "2", "1"];
const DSE_GRADES = ["5**", "5*", "5", "4", "3", "2", "1", "U"];
const ALEVEL_GRADES = ["A*", "A", "B", "C", "D", "E", "U"];
const IGCSE_GRADES_NUMERIC = ["9", "8", "7", "6", "5", "4", "3", "2", "1", "U"];
const IGCSE_GRADES_LEGACY = ["A*", "A", "B", "C", "D", "E", "F", "G", "U"];
const AP_GRADES = ["5", "4", "3", "2", "1"];

const satGradesFor = (subject: string): string[] => {
  if (subject === "SAT (Total)") {
    // 400–1600 in 10-point steps
    const out: string[] = [];
    for (let s = 1600; s >= 400; s -= 10) out.push(String(s));
    return out;
  }
  if (subject.startsWith("SAT Evidence") || subject === "SAT Math") {
    // 200–800 in 10-point steps
    const out: string[] = [];
    for (let s = 800; s >= 200; s -= 10) out.push(String(s));
    return out;
  }
  if (subject.startsWith("SAT Essay")) {
    // Three domain scores 2–8 → we surface a single band
    return ["8/8/8", "7/7/7", "6/6/6", "5/5/5", "4/4/4", "3/3/3", "2/2/2"];
  }
  return [];
};

export const EXAM_SYSTEMS: ExamSystem[] = [
  { id: "ib", label: "IB Diploma", subjects: IB_SUBJECTS, grades: IB_GRADES },
  { id: "dse", label: "HKDSE", subjects: DSE_SUBJECTS, grades: DSE_GRADES },
  { id: "alevel", label: "GCE A-Level", subjects: ALEVEL_SUBJECTS, grades: ALEVEL_GRADES },
  {
    id: "igcse",
    label: "IGCSE / GCSE",
    subjects: IGCSE_SUBJECTS,
    grades: [...IGCSE_GRADES_NUMERIC, ...IGCSE_GRADES_LEGACY.map((g) => `${g} (legacy)`)],
  },
  { id: "ap", label: "AP", subjects: AP_SUBJECTS, grades: AP_GRADES },
  { id: "sat", label: "SAT", subjects: SAT_SUBJECTS, grades: [], gradesFor: satGradesFor },
  { id: "other", label: "Other", subjects: [], freeSubject: true, grades: [] },
];

export function getSystem(id: string): ExamSystem | undefined {
  return EXAM_SYSTEMS.find((s) => s.id === id);
}

export function getGradesForSelection(systemId: string, subject: string): string[] {
  const sys = getSystem(systemId);
  if (!sys) return [];
  if (sys.gradesFor) return sys.gradesFor(subject);
  return sys.grades;
}

export type ExamResultEntry = { subject: string; grade: string };

export type ExamResult = {
  system: ExamSystemId | string;
  subjects: ExamResultEntry[];
};

/** Accepts both the new grouped shape and legacy flat rows. */
export function normalizeExamResults(raw: unknown): ExamResult[] {
  if (!Array.isArray(raw)) return [];
  const bySystem = new Map<string, ExamResultEntry[]>();
  const order: string[] = [];
  for (const item of raw as Array<Record<string, unknown>>) {
    if (!item || typeof item !== "object") continue;
    const system = String(item.system ?? "").trim();
    if (!system) continue;
    if (!bySystem.has(system)) {
      bySystem.set(system, []);
      order.push(system);
    }
    const bucket = bySystem.get(system)!;
    if (Array.isArray(item.subjects)) {
      for (const s of item.subjects as Array<Record<string, unknown>>) {
        const subject = String(s?.subject ?? "").trim();
        const grade = String(s?.grade ?? "").trim();
        if (subject && grade) bucket.push({ subject, grade });
      }
    } else if (item.subject && item.grade) {
      bucket.push({ subject: String(item.subject).trim(), grade: String(item.grade).trim() });
    }
  }
  return order
    .map((sys) => ({ system: sys, subjects: bySystem.get(sys) ?? [] }))
    .filter((r) => r.subjects.length > 0);
}

