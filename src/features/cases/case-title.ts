// Issue #423 (sections 2+3) — bilingual structured auto-title.
//
// Kills the free-text title: a case title is generated from the strict
// structured fields in the #411 dual-language pattern:
//   EN:    `[Curriculum] [Subject] — [Grade]`  e.g. "IBDP Chemistry HL — Y12"
//   zh-HK: the parallel structured string       e.g. "IBDP 化學 HL — 中六"
//
// Rule-based only (the repo has NO AI features — CEO lock, see
// headline-translate.ts): known subjects/curricula/grades translate through
// the dictionaries below; unknown tokens pass through verbatim so a custom
// parent-typed subject never breaks the title. The stored `title` column is
// kept for legacy rows — display surfaces use the structured title when the
// structured fields suffice and fall back to the stored title only for rows
// the helper can't express.

export type CaseTitleLocale = "en" | "zh-HK";

export type CaseTitleFields = {
  /** exam_system value ("IB" | "DSE" | "A-Level" | "Primary School" | …). */
  curriculum?: string | null;
  subjects?: readonly string[];
  /** student_level (or legacy free year like "Y12" / "S5"). */
  grade?: string | null;
};

/**
 * #423 board-item → title-fields boundary mapping. `PublicCaseBoardItem`
 * stores the exam system in `examSystem` and the level in `studentLevel`
 * (NOT `curriculum`/`grade`) — the mapping is explicit here so no surface
 * can pass the raw item and silently title subject-only (GLM review, 2026-
 * 10-23). Structural param: case-title stays decoupled from cases.functions.
 */
export type CaseBoardTitleSource = {
  examSystem: string | null;
  subjects: string[];
  studentLevel: string;
};

export function caseTitleFieldsFromBoard(item: CaseBoardTitleSource): CaseTitleFields {
  return {
    curriculum: item.examSystem,
    subjects: item.subjects,
    grade: item.studentLevel,
  };
}

// --- Curriculum labels ------------------------------------------------------

const CURRICULUM_LABELS: Record<string, Record<CaseTitleLocale, string>> = {
  IB: { en: "IBDP", "zh-HK": "IBDP" },
  DSE: { en: "DSE", "zh-HK": "DSE" },
  "A-Level": { en: "A-Level", "zh-HK": "A-Level" },
  IGCSE: { en: "IGCSE", "zh-HK": "IGCSE" },
  AP: { en: "AP", "zh-HK": "AP" },
  "Primary School": { en: "Primary School", "zh-HK": "小學" },
  "Local Primary": { en: "Primary School", "zh-HK": "小學" },
  "Int'l Primary": { en: "Primary School", "zh-HK": "小學" },
  "Junior Secondary": { en: "Junior Secondary", "zh-HK": "初中" },
  Kindergarten: { en: "Kindergarten", "zh-HK": "幼稚園" },
  University: { en: "University", "zh-HK": "大學" },
  Admissions: { en: "University Admissions", "zh-HK": "大學入學" },
};

// Curricula that are meaningless as a title lead — skip them.
const CURRICULUM_SKIP = new Set(["Not sure yet", "Other"]);

// --- Grade labels -----------------------------------------------------------

const GRADE_LABELS: Record<string, Record<CaseTitleLocale, string>> = {
  Kindergarten: { en: "Kindergarten", "zh-HK": "幼稚園" },
  Primary: { en: "Primary", "zh-HK": "小學" },
  "Junior secondary": { en: "Junior secondary", "zh-HK": "初中" },
  "Senior secondary": { en: "Senior secondary", "zh-HK": "高中" },
  University: { en: "University", "zh-HK": "大學" },
};

// --- Subject tokens (zh-HK) -------------------------------------------------
// Token-level so compounds translate: "Chemistry HL" → "化學 HL". Longest
// phrases first where order matters (checked by exact phrase, so order is
// only a readability concern here).

const SUBJECT_ZH: Record<string, string> = {
  mathematics: "數學",
  maths: "數學",
  math: "數學",
  "further mathematics": "延伸數學",
  "further math": "延伸數學",
  "further maths": "延伸數學",
  "math aa": "數學 AA",
  "math ai": "數學 AI",
  m1: "M1",
  m2: "M2",
  physics: "物理",
  chemistry: "化學",
  biology: "生物",
  "combined science": "組合科學",
  "integrated science": "綜合科學",
  "double science": "雙科學",
  science: "科學",
  economics: "經濟",
  "business management": "企業管理",
  business: "商科",
  accounting: "會計",
  bafs: "企業、會計與財務概論",
  english: "英文",
  chinese: "中文",
  "chinese literature": "中國文學",
  "english literature": "英國文學",
  literature: "文學",
  mandarin: "普通話",
  french: "法文",
  spanish: "西班牙文",
  japanese: "日文",
  korean: "韓文",
  german: "德文",
  history: "歷史",
  "chinese history": "中國歷史",
  geography: "地理",
  "liberal studies": "通識教育",
  "citizenship and social development": "公民與社會發展",
  "travel and hospitality": "旅遊與款待",
  "health management": "健康管理與社會關懷",
  "design and technology": "設計與科技",
  "computer science": "電腦科學",
  ict: "資訊及通訊科技",
  "information and communication technology": "資訊及通訊科技",
  "design and applied technology": "設計與應用科技",
  music: "音樂",
  art: "視覺藝術",
  "visual arts": "視覺藝術",
  pe: "體育",
  "physical education": "體育",
  philosophy: "哲學",
  psychology: "心理學",
  "world religions": "世界宗教",
  ethics: "倫理",
  theatre: "戲劇",
  film: "電影",
  phonics: "拼音",
  "interview preparation": "面試準備",
  "personal statement": "個人陳述",
  ielts: "IELTS",
  sat: "SAT",
  act: "ACT",
  toefl: "TOEFL",
  ucat: "UCAT",
  isat: "ISAT",
};

// Score/level qualifiers that always stay verbatim (mirror of
// headline-translate's keep-list for the case vocabulary).
const SUBJECT_KEEP_RE = /^(?:hl|sl|a\*|ibdp|hkdse|igcse|gce|a-level|alevel|ap|m1|m2)$/i;

function translateSubjectZh(subject: string): string {
  const trimmed = subject.trim();
  if (!trimmed) return "";
  const phrase = SUBJECT_ZH[trimmed.toLowerCase()];
  if (phrase) return phrase;
  // Token-wise fallback: translate known words, keep the rest verbatim.
  const tokens = trimmed.split(/\s+/);
  const out = tokens.map((token) => {
    if (SUBJECT_KEEP_RE.test(token)) return token;
    return SUBJECT_ZH[token.toLowerCase()] ?? token;
  });
  return out.join(" ");
}

function firstPart(list: readonly string[]): { text: string; extra: number } {
  const clean = list.map((s) => s.trim()).filter(Boolean);
  return { text: clean[0] ?? "", extra: Math.max(0, clean.length - 1) };
}

/**
 * The structured bilingual case title. Returns "" when the structured
 * fields don't suffice (no curriculum, subject, or grade) — the caller
 * then falls back to the stored legacy title.
 */
export function buildCaseTitle(fields: CaseTitleFields, locale: CaseTitleLocale = "en"): string {
  const curriculumRaw = fields.curriculum?.trim() ?? "";
  const curriculum =
    curriculumRaw && !CURRICULUM_SKIP.has(curriculumRaw)
      ? (CURRICULUM_LABELS[curriculumRaw]?.[locale] ?? curriculumRaw)
      : "";
  const subject = firstPart(fields.subjects ?? []);
  const subjectText = subject.text
    ? locale === "zh-HK"
      ? translateSubjectZh(subject.text)
      : subject.text
    : "";
  const subjectExtra = subject.extra > 0 ? ` +${subject.extra}` : "";
  const gradeRaw = fields.grade?.trim() ?? "";
  const grade = gradeRaw ? (GRADE_LABELS[gradeRaw]?.[locale] ?? gradeRaw) : "";

  const lead = [curriculum, subjectText].filter(Boolean).join(" ") + subjectExtra;
  const parts = [lead || curriculum || subjectText, grade].filter(Boolean);
  if (!parts[0]) return "";
  return parts.join(" — ");
}
