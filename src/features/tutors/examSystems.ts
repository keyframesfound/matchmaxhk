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

export const IB_BLOCKS = [
  ["Group 1: Studies in Language and Literature", ["Eng A Lang Lit HL", "Eng A Lang Lit SL", "Eng A Lit HL", "Eng A Lit SL", "Chin A Lang Lit HL", "Chin A Lang Lit SL", "Chin A Lit HL", "Chin A Lit SL"]],
  ["Group 2: Language Acquisition", ["Eng B HL", "Eng B SL", "Chin B HL", "Chin B SL", "French B HL", "French B SL", "Spanish B HL", "Spanish B SL", "German B HL", "German B SL", "Japanese B HL", "Japanese B SL", "Spanish Ab Initio SL"]],
  ["Group 3: Individuals and Societies", ["Business Management HL", "Business Management SL", "Econ HL", "Econ SL", "Geog HL", "Geog SL", "Global Pol HL", "Global Pol SL", "Hist HL", "Hist SL", "Phil HL", "Phil SL", "Psych HL", "Psych SL", "ESS HL", "ESS SL"]],
  ["Group 4: Sciences", ["Bio HL", "Bio SL", "Chem HL", "Chem SL", "CompSci HL", "CompSci SL", "Design Tech HL", "Design Tech SL", "Phys HL", "Phys SL", "SEHS HL", "SEHS SL"]],
  ["Group 5: Mathematics", ["Math AA HL", "Math AA SL", "Math AI HL", "Math AI SL"]],
  ["Group 6: The Arts / Elective", ["Visual Arts HL", "Visual Arts SL", "Music HL", "Music SL", "Theatre HL", "Theatre SL", "Film HL", "Film SL", "Dance HL", "Dance SL"]],
  ["Theory of Knowledge (TOK)", ["TOK"]],
  ["Extended Essay (EE)", ["Extended Essay"]],
] as const;

const IB_SUBJECTS = IB_BLOCKS.flatMap(([, subjects]) => subjects);

const DSE_SUBJECTS = [
  "Chin Lang",
  "Eng Lang",
  "Math Compulsory",
  "Math Ext M1",
  "Math Ext M2",
  "Lib Studies",
  "CSD",
  "Biology",
  "Chemistry",
  "Physics",
  "Combined Sci",
  "Integrated Sci",
  "Economics",
  "BAFS (Acct)",
  "BAFS (Bus Mgmt)",
  "Geography",
  "History",
  "Chin Hist",
  "Tourism & Hosp",
  "ICT",
  "D&AT",
  "HMSC",
  "Visual Arts",
  "Music",
  "PE",
  "Lit in Eng",
  "Chin Lit",
  "French",
  "German",
  "Japanese",
  "Spanish",
  "Korean",
  "Hindi",
  "Urdu",
];

const ALEVEL_SUBJECTS = [
  "Mathematics",
  "Further Math",
  "Statistics",
  "Physics",
  "Chemistry",
  "Biology",
  "CompSci",
  "Economics",
  "Business",
  "Accounting",
  "Geography",
  "History",
  "Politics",
  "Psychology",
  "Sociology",
  "Law",
  "Philosophy",
  "Eng Lang",
  "Eng Lit",
  "French",
  "Spanish",
  "German",
  "Mandarin",
  "Latin",
  "Art & Design",
  "Music",
  "Drama & Theatre",
  "Media Studies",
];

const IGCSE_SUBJECTS = [
  "Mathematics",
  "Add'l Math",
  "Intl Math",
  "1st Lang Eng",
  "ESL",
  "Eng Lit",
  "1st Lang Chin",
  "Chin as 2nd Lang",
  "Biology",
  "Chemistry",
  "Physics",
  "Combined Sci",
  "Coord Sci",
  "Economics",
  "Bus Studies",
  "Accounting",
  "Geography",
  "History",
  "Global Persp",
  "CompSci",
  "ICT",
  "D&T",
  "French",
  "Spanish",
  "German",
  "Mandarin",
  "Art & Design",
  "Music",
  "Drama",
  "PE",
];

const AP_SUBJECTS = [
  "Calc AB",
  "Calc BC",
  "Statistics",
  "Precalculus",
  "Biology",
  "Chemistry",
  "Phys 1",
  "Phys 2",
  "Phys C: Mech",
  "Phys C: E&M",
  "Env Sci",
  "CompSci A",
  "CompSci Principles",
  "Microeconomics",
  "Macroeconomics",
  "US Gov & Pol",
  "Comp Gov & Pol",
  "US Hist",
  "World Hist",
  "Euro Hist",
  "Human Geo",
  "Psychology",
  "Eng Lang & Comp",
  "Eng Lit & Comp",
  "Chin Lang & Culture",
  "Spanish Lang & Culture",
  "French Lang & Culture",
  "Japanese Lang & Culture",
  "German Lang & Culture",
  "Latin",
  "Art Hist",
  "Studio Art",
  "Music Theory",
];

const SAT_SUBJECTS = ["SAT Total", "SAT EBRW", "SAT Math", "SAT Essay (legacy)"];

const IB_GRADES = ["7", "6", "5", "4", "3", "2", "1"];
const DSE_GRADES = ["5**", "5*", "5", "4", "3", "2", "1", "U"];
const ALEVEL_GRADES = ["A*", "A", "B", "C", "D", "E", "U"];
const IGCSE_GRADES_NUMERIC = ["9", "8", "7", "6", "5", "4", "3", "2", "1", "U"];
const IGCSE_GRADES_LEGACY = ["A*", "A", "B", "C", "D", "E", "F", "G", "U"];
const AP_GRADES = ["5", "4", "3", "2", "1"];

const ibGradesFor = (subject: string): string[] => {
  if (["TOK", "Extended Essay"].includes(subject)) return ["A", "B", "C", "D", "E"];
  return IB_GRADES;
};

const dseGradesFor = (subject: string): string[] => {
  if (subject === "CSD") return ["Pass", "Fail"];
  return DSE_GRADES;
};

const satGradesFor = (subject: string): string[] => {
  if (subject === "SAT Total") {
    // 400–1600 in 10-point steps
    const out: string[] = [];
    for (let s = 1600; s >= 400; s -= 10) out.push(String(s));
    return out;
  }
  if (subject.startsWith("SAT EBRW") || subject === "SAT Math") {
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
  { id: "ib", label: "IB Diploma", subjects: IB_SUBJECTS, grades: IB_GRADES, gradesFor: ibGradesFor },
  { id: "dse", label: "HKDSE", subjects: DSE_SUBJECTS, grades: DSE_GRADES, gradesFor: dseGradesFor },
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

export type ExamPaperScore = { label: string; score: string };

export const EXAM_PAPER_LABELS = ["Paper 1", "Paper 2", "Paper 3"] as const;

export type ExamResultEntry = { subject: string; grade: string; papers?: ExamPaperScore[] };

export type ExamResult = {
  system: ExamSystemId | string;
  subjects: ExamResultEntry[];
};

function normalizePapers(raw: unknown): ExamPaperScore[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const entry = value as Record<string, unknown>;
    const label = String(entry.label ?? "").trim();
    const score = String(entry.score ?? "").trim();
    if (!label || !score) return [];
    return [{ label, score }];
  });
}

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
        const papers = normalizePapers(s?.papers);
        if (subject) bucket.push({ subject, grade, ...(papers.length ? { papers } : {}) });
      }
    } else if (item.subject) {
      bucket.push({ subject: String(item.subject).trim(), grade: String(item.grade ?? "").trim() });
    }
  }
  return order
    .map((sys) => ({ system: sys, subjects: bySystem.get(sys) ?? [] }))
    .filter((r) => r.subjects.length > 0);
}

