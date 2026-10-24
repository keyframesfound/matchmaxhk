// Dual-notation display labels: international schools use "Year X",
// local schools use "S1–S6". Stored student_level values stay unchanged.
const STUDENT_LEVEL_BOARD_LABELS: Record<string, string> = {
  "Junior secondary": "Year 7–9 / S1–S3",
  "Senior secondary": "Year 10–13 / S4–S6",
};

export function formatStudentLevel(level: string | null | undefined): string {
  const value = (level ?? "").trim();
  if (!value) return "";
  return STUDENT_LEVEL_BOARD_LABELS[value] ?? value;
}

export function formatCaseTitle(studentLevel: string, subjects: string[]): string {
  const levelLabel = formatStudentLevel(studentLevel) || studentLevel;
  const subjectPart = subjects.filter(Boolean).slice(0, 2).join(", ");
  const extra =
    subjects.filter(Boolean).length > 2 ? ` +${subjects.filter(Boolean).length - 2} more` : "";
  return subjectPart ? `${levelLabel}: ${subjectPart}${extra}` : levelLabel;
}

export function buildCaseApplyWhatsAppUrl(whatsappNumber: string, caseCode: string): string {
  const digits = whatsappNumber.replace(/[^\d]/g, "");
  const message = `Hi MatchMax! I'd like to apply for case ${caseCode}.`;
  // With no configured number, wa.me still opens WhatsApp with the prefilled
  // message and lets the user pick the MatchMax chat.
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export const CASE_MODE_LABEL: Record<string, string> = {
  online: "Online",
  in_person: "In-person",
  either: "Online & in-person",
};

export const CASE_GENDER_LABEL: Record<string, string> = {
  any: "No preference",
  female: "Female tutor",
  male: "Male tutor",
};

// Covers both legacy tokens (en / zh-HK / either) and the 3-step form tokens.
export const CASE_LANGUAGE_LABEL: Record<string, string> = {
  en: "English",
  "zh-HK": "Cantonese",
  either: "No preference",
  english_only: "English",
  cantonese: "Cantonese",
  mandarin: "Mandarin",
  bilingual: "Bilingual",
  any: "No preference",
};

export const CASE_START_LABEL: Record<string, string> = {
  asap: "Starts ASAP",
  two_weeks: "Within 2 weeks",
  flexible: "Flexible start",
};

/**
 * Issue #423 rate matrix — never render `HK$?`:
 *   set/set    → HK$300–500/hr (equal bounds collapse to HK$500/hr)
 *   blank/set  → Up to HK$500/hr
 *   set/blank  → From HK$300/hr
 *   blank/blank→ "" (board hides the row) or "Rate TBA" (detail surfaces).
 */
export function formatCaseBudget(
  min: number | null,
  max: number | null,
  opts?: { detail?: boolean },
): string {
  if (min !== null && max !== null) {
    return min === max ? `HK$${min}/hr` : `HK$${min}–${max}/hr`;
  }
  if (max !== null) return `Up to HK$${max}/hr`;
  if (min !== null) return `From HK$${min}/hr`;
  return opts?.detail ? "Rate TBA" : "";
}

/**
 * Issue #112: budgets are stored in the requester's native currency
 * (budget_min/max) alongside HKD-normalized snapshots maintained by the DB
 * trigger. Public surfaces compare and display the normalized values; the
 * native fallback covers pre-migration rows whose snapshots are still null.
 */
export function caseBudgetHkdBounds(item: {
  budgetMin: number | null;
  budgetMax: number | null;
  budgetMinHkd: number | null;
  budgetMaxHkd: number | null;
}): { min: number | null; max: number | null } {
  return {
    min: item.budgetMinHkd ?? item.budgetMin,
    max: item.budgetMaxHkd ?? item.budgetMax,
  };
}

/** formatCaseBudget over the HKD-normalized bounds. */
export function formatCaseBudgetHkd(
  item: {
    budgetMin: number | null;
    budgetMax: number | null;
    budgetMinHkd: number | null;
    budgetMaxHkd: number | null;
  },
  opts?: { detail?: boolean },
): string {
  const { min, max } = caseBudgetHkdBounds(item);
  return formatCaseBudget(min, max, opts);
}

export function formatCaseSchedule(sessionsPerWeek: number, sessionLengthMinutes: number): string {
  return `${sessionsPerWeek}x/week · ${sessionLengthMinutes} min`;
}
