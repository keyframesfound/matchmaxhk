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

// zh-HK variants feeding the public case-detail localized lines (#430 GLM
// round-3 minor): the English maps above stay the canonical labels for the
// board card logistics line and admin surfaces; these translate the value
// slot inside the detail page's preference/lesson sentences. Unknown tokens
// fall through to the caller's raw-value rendering.
export const CASE_MODE_LABEL_ZH: Record<string, string> = {
  online: "網上",
  in_person: "面對面",
  either: "網上或面對面",
};

export const CASE_GENDER_LABEL_ZH: Record<string, string> = {
  any: "不限",
  female: "女導師",
  male: "男導師",
};

export const CASE_LANGUAGE_LABEL_ZH: Record<string, string> = {
  en: "英文",
  "zh-HK": "廣東話",
  either: "不限",
  english_only: "英文",
  cantonese: "廣東話",
  mandarin: "普通話",
  bilingual: "雙語",
  any: "不限",
};

export const CASE_START_LABEL_ZH: Record<string, string> = {
  asap: "盡快開始",
  two_weeks: "兩星期內",
  flexible: "時間靈活",
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

// Issue #412 E: the centre screening summary values shown to tutors, in both
// locales. Keyed by the raw triage token; unknown tokens pass through.
export const CASE_SCREENING_LABELS: Record<string, Record<"en" | "zh-HK", string>> = {
  organisation_self: {
    en: "The centre directly (verified BR entity)",
    "zh-HK": "由機構直接委聘（已核實商業登記）",
  },
  third_party: { en: "A third-party organisation", "zh-HK": "第三方機構" },
  hourly: { en: "Hourly service fee", "zh-HK": "按小時服務費" },
  per_session: { en: "Per-session service fee", "zh-HK": "按節服務費" },
  revenue_split: { en: "Course revenue-split ratio %", "zh-HK": "課程分成比例 %" },
  organisation: { en: "Organisation", "zh-HK": "機構" },
  educator: { en: "Educator", "zh-HK": "導師" },
  online_shared: { en: "Online / shared", "zh-HK": "網上／共用" },
  educator_method: { en: "Educator independently", "zh-HK": "由導師自行決定" },
  mutual: { en: "Mutual alignment on syllabus goals", "zh-HK": "雙方就教學目標達成共識" },
  centre_controlled: { en: "Strictly controlled by centre", "zh-HK": "由機構嚴格規定" },
  yes: { en: "Yes", "zh-HK": "是" },
  no: { en: "No", "zh-HK": "否" },
  open: { en: "Open to discussion", "zh-HK": "可再商議" },
};

export function caseScreeningLabel(token: string | null, locale: "en" | "zh-HK"): string | null {
  if (!token) return null;
  return CASE_SCREENING_LABELS[token]?.[locale] ?? token;
}
