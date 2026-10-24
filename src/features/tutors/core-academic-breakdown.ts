import { getSystem, type ExamResult, type ExamPaperScore } from "@/features/tutors/examSystems";

/**
 * Issue #411, Core Academic Breakdown.
 *
 * One pure builder shared by the tutor card (grade pills) and the detail page
 * (vertical-bar grade rows): groups the tutor's public exam results per
 * curriculum and lifts the curriculum TOTAL into the group header
 * (e.g. "IBDP: 41/45"). Totals come from, in order:
 *   1. a headline segment like "IBDP 41/45" whose leading curriculum token
 *      matches this system (the old academic_headline format),
 *   2. a score entry whose subject is a total/overall ("SAT Total",
 *      "IELTS Overall"), that entry is then excluded from the grade rows.
 *
 * Edge cases (issue #411):
 * - subjects but no total -> the group header is the curriculum name only;
 * - no exam scores/grades at all (Examiner / pro tutors) -> an empty array,
 *   and both surfaces hide the entire section.
 */

export type CoreAcademicGrade = {
  subject: string;
  /** Cleaned for display: "(legacy)" stripped, leading "Grade "/"Band " dropped. */
  grade: string;
  papers?: ExamPaperScore[];
};

export type CoreAcademicGroup = {
  /** Display label, e.g. "IBDP", "GCE A-Level", "SAT". */
  curriculum: string;
  /** e.g. "41/45", "9A*", "1520"; null = show the curriculum name only. */
  total: string | null;
  grades: CoreAcademicGrade[];
};

export function formatExamSystemLabel(system: string): string {
  const normalized = system.trim().toLowerCase();

  if (normalized === "ib" || normalized === "ibdp") return "IBDP";
  if (normalized === "dse" || normalized === "hkdse") return "HKDSE";
  if (normalized === "alevel" || normalized === "a-level" || normalized === "gce a-level")
    return "GCE A-Level";
  if (normalized === "igcse" || normalized === "gcse") return "IGCSE / GCSE";
  if (normalized === "ap") return "AP";
  if (normalized === "sat") return "SAT";
  if (normalized === "ielts") return "IELTS";
  if (normalized === "isat") return "ISAT";
  if (normalized === "ucat") return "UCAT";
  if (normalized === "primary") return "Primary School";
  if (normalized === "junior secondary") return "Junior Secondary";
  if (normalized === "admissions") return "University Admissions & Test Prep";

  const systemName = system.trim();
  return (getSystem(normalized)?.label ?? systemName) || "Exam system";
}

/** "(legacy)" suffix stripped (#206); leading "Grade "/"Band " noun dropped. */
export function cleanGradeForDisplay(grade: string): string {
  return grade
    .replace(/\s*\(legacy\)\s*$/i, "")
    .replace(/^(grade|band)\s+/i, "")
    .trim();
}

const TOTAL_SUBJECT_RE = /\b(total|overall)\b/i;

/**
 * Map of curriculum-label (lowercase) -> total, parsed from the academic
 * headline's "<Curriculum> <Score>" segments ("IBDP 41/45 - IGCSE 9A*").
 * "<Curriculum> Tutor" (rule 3 of the headline generator) is NOT a total.
 */
export function parseHeadlineTotals(academicHeadline: string | null | undefined): string[] {
  const headline = (academicHeadline ?? "").trim();
  if (!headline) return [];
  return headline
    .split(/\r?\n|\s*\|\s*|\s+-\s+|\s+–\s+/u)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function headlineTotalFor(labels: string[], headline: string | null | undefined): string | null {
  const candidates = parseHeadlineTotals(headline);
  for (const label of labels) {
    const normalizedLabel = label.trim().toLowerCase();
    if (!normalizedLabel) continue;
    for (const segment of candidates) {
      const lower = segment.toLowerCase();
      if (!lower.startsWith(normalizedLabel)) continue;
      const rest = segment.slice(label.trim().length).trim();
      // "<Curriculum> Tutor" is the no-score fallback, never a total; and the
      // rest must be a SCORE token ("41/45", "9A*", "1520"), not free text
      // like "Straight 5/5 Specialist" which merely starts with the label.
      if (!rest || rest.toLowerCase() === "tutor") continue;
      if (!HEADLINE_SCORE_RE.test(rest)) continue;
      return rest;
    }
  }
  return null;
}

/** "41/45" | "9A*" | "1520" | "32" | "7.5", a bare score, never prose. */
const HEADLINE_SCORE_RE = /^\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?(?:[A-Za-z*]{1,4})?$/u;

export function buildCoreAcademicBreakdown(
  examResults: ExamResult[],
  academicHeadline?: string | null,
): CoreAcademicGroup[] {
  const groups: CoreAcademicGroup[] = [];

  for (const result of examResults) {
    const system = (result.system ?? "").trim();
    if (!system) continue;
    const curriculum = formatExamSystemLabel(system);
    const headlineLabels = [curriculum, system];
    let total = headlineTotalFor(headlineLabels, academicHeadline);
    const grades: CoreAcademicGrade[] = [];

    for (const entry of result.subjects ?? []) {
      const subject = (entry.subject ?? "").trim();
      if (!subject) continue;
      const grade = cleanGradeForDisplay(entry.grade ?? "");
      if (TOTAL_SUBJECT_RE.test(subject) && grade) {
        // "SAT Total" / "IELTS Overall": the entry IS the total, lift it
        // into the header instead of listing it as a row.
        total = total ?? grade;
        continue;
      }
      const papers = (entry.papers ?? []).filter((p) => p.label.trim() && p.score.trim());
      grades.push({
        subject,
        grade,
        ...(papers.length > 0 ? { papers } : {}),
      });
    }

    if (grades.length === 0 && !total) continue;
    groups.push({ curriculum, total, grades });
  }

  return groups;
}

/** Total grade rows across every group, drives the "View all N grades" toggle. */
export function countCoreAcademicGrades(groups: CoreAcademicGroup[]): number {
  return groups.reduce((sum, group) => sum + group.grades.length, 0);
}
