// Dual-notation display labels: international schools use "Year X",
// local schools use "S1–S6". Stored student_level values stay unchanged.
import {
  convertCurrency,
  DEFAULT_CURRENCY,
  formatMoney,
  type CurrencyCode,
  type HkdRates,
} from "@/lib/money";

const STUDENT_LEVEL_BOARD_LABELS: Record<string, string> = {
  "Junior secondary": "Year 7–9 / S1–S3",
  "Senior secondary": "Year 10–13 / S4–S6",
};

export function formatStudentLevel(level: string | null | undefined): string {
  const value = (level ?? "").trim();
  if (!value) return "";
  return STUDENT_LEVEL_BOARD_LABELS[value] ?? value;
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
 * Issue #423 rate formatter matrix — `HK$?` may NEVER render.
 *
 * | min    | max    | Render              |
 * |--------|--------|---------------------|
 * | set    | set    | `HK$300–500/hr`     |
 * | blank  | set    | `Up to HK$500/hr`   |
 * | set    | blank  | `From HK$300/hr`    |
 * | blank  | blank  | `""` (caller omits) |
 *
 * tutoring_cases has no rate_unit column today (the form collects hourly
 * budgets only), so callers get the `/hr` suffix by default; the unit
 * parameter is forward-compatible with a future hr/lesson/month column.
 */
export type CaseRateUnit = "hr" | "lesson" | "month";

const RATE_UNIT_SUFFIX: Record<CaseRateUnit, string> = {
  hr: "/hr",
  lesson: "/lesson",
  month: "/month",
};

export function formatCaseRate(
  min: number | null | undefined,
  max: number | null | undefined,
  unit: CaseRateUnit = "hr",
): string {
  const suffix = RATE_UNIT_SUFFIX[unit] ?? "/hr";
  const hasMin = min !== null && min !== undefined;
  const hasMax = max !== null && max !== undefined;
  if (!hasMin && !hasMax) return "";
  if (!hasMin) return `Up to HK$${max}${suffix}`;
  if (!hasMax) return `From HK$${min}${suffix}`;
  return `HK$${min}\u2013${max}${suffix}`;
}

/** formatCaseRate over the hourly budget bounds (the stored shape today). */
export function formatCaseBudget(min: number | null, max: number | null): string {
  return formatCaseRate(min, max);
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
export function formatCaseBudgetHkd(item: {
  budgetMin: number | null;
  budgetMax: number | null;
  budgetMinHkd: number | null;
  budgetMaxHkd: number | null;
}): string {
  const { min, max } = caseBudgetHkdBounds(item);
  return formatCaseBudget(min, max);
}

/**
 * Issue #113: an authenticated tutor's view of a case budget. Primary is the
 * HKD-normalized bounds converted into the tutor's quoting currency (null
 * when they quote HKD or rates are unavailable — callers keep the plain HKD
 * rendering); `original` always carries the HKD figure so nothing is hidden.
 */
export function caseBudgetForTutor(
  item: {
    budgetMin: number | null;
    budgetMax: number | null;
    budgetMinHkd: number | null;
    budgetMaxHkd: number | null;
  },
  tutorCurrency: CurrencyCode,
  rates: HkdRates,
  unit: CaseRateUnit = "hr",
): { primary: string | null; original: string } {
  const { min, max } = caseBudgetHkdBounds(item);
  const suffix = RATE_UNIT_SUFFIX[unit] ?? "/hr";
  const original = formatCaseRate(min, max, unit);
  if (!original) return { primary: null, original };
  if (tutorCurrency === DEFAULT_CURRENCY) return { primary: null, original };
  const convert = (value: number | null | undefined): string | null => {
    if (value === null || value === undefined) return null;
    const converted = convertCurrency(value, DEFAULT_CURRENCY, tutorCurrency, rates);
    return Number.isFinite(converted) ? formatMoney(converted, tutorCurrency) : null;
  };
  // Same matrix as formatCaseRate, with each bound converted first (#423).
  if (min === null) {
    const to = convert(max);
    return to ? { primary: `Up to ${to}${suffix}`, original } : { primary: null, original };
  }
  if (max === null) {
    const from = convert(min);
    return from ? { primary: `From ${from}${suffix}`, original } : { primary: null, original };
  }
  const from = convert(min);
  const to = convert(max);
  if (!from || !to) return { primary: null, original };
  return { primary: `${from}\u2013${to}${suffix}`, original };
}

export function formatCaseSchedule(sessionsPerWeek: number, sessionLengthMinutes: number): string {
  return `${sessionsPerWeek}x/week · ${sessionLengthMinutes} min`;
}
