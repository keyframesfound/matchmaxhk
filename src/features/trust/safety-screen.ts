/**
 * Issue #529 — website pre-match risk screen (rules, not an LLM).
 *
 * Runs on the raw parent request before insert. Each hit becomes a
 * case_risk_flags row (source = system); HOLD types also route the request to
 * the existing compliance_hold desk state (#412 E), which keeps it off the
 * public board until staff re-screen. Advisory types only flag. Nothing here
 * bans or blacklists: humans resolve every flag (#529 §5).
 *
 * Privacy (#529 D): only the matched keyword is kept as evidence, never the
 * surrounding free text.
 *
 * The request form has no address or lesson-time fields yet, so location and
 * late-night rules read the free-text fields (notes, district, school) the
 * form does collect; an address field will plug into the same patterns.
 */

import type { CaseRiskFlagType } from "@/features/trust/trust";

export type ScreenInput = {
  notes?: string | null;
  district?: string | null;
  targetSchool?: string | null;
  /** "myself" = the learner is the requester, i.e. an adult learner. */
  whoFor?: string | null;
  /** "male" | "female" | "any" (case_gender_pref). */
  preferredGender?: string | null;
};

export type ScreenHit = { flagType: CaseRiskFlagType; hold: boolean; evidence: string };

export type ScreenResult = { hits: ScreenHit[]; hold: boolean };

/** 21:30, the #529 late-night threshold, in minutes from midnight. */
export const LATE_NIGHT_MINUTES = 21 * 60 + 30;

// Location-shaped phrases only: "Hotel management", "industrial engineering"
// and 酒店管理 are study subjects, not venues, so they never match.
const HIGH_RISK_LOCATION =
  /(工廠|工業大廈|工業中心|賓館|時鐘酒店|酒店(?!管理|款待|業)|旅館|\bindustrial\s+(building|bldg|centre|center|estate)\b|\bind\.?\s*bldg\b|\bfactory\b|\bhotel\b(?!\s*(management|and tourism|& tourism|studies|school))|\bguest\s*house\b)/i;

// Only unambiguous scam mechanics hold a case. "Overpay" and paying
// "months in advance" are ordinary parent phrasing, so they are not here.
const SCAM_OVERPAYMENT =
  /(wire transfer|cashier'?s? cheque|bank draft|western union|bitcoin|crypto|usdt|gift ?cards?|refund the (difference|balance)|overpaid.{0,20}refund|匯款|本票|加密貨幣|比特幣|禮品卡|退返差額)/i;

const BYPASS_COLLUSION =
  /(pay (the tutor )?direct(ly)?|skip (the )?(agency|matchmax)|without (going through )?matchmax|off[- ]platform|tell matchmax (we|i) stopped|私下(交易|付款|俾錢)|唔經\s*matchmax|直接俾錢)/i;

const SERIAL_HOPPER =
  /(tried \d+ (other )?(agencies|tutors|centres|centers)|試過\s*\d+\s*(間|個)\s*(中介|補習社|導師))/i;

const CLOCK_24H = /\b(2[0-3]|1\d|0?\d)[:：]([0-5]\d)\b/g;
const CLOCK_PM = /\b(1[0-2]|0?\d)(?:[:：.]([0-5]\d))?\s*(pm|p\.m\.)/gi;
const CLOCK_ZH_EVENING =
  /(晚上|夜晚|晚)\s*(\d{1,2}|十一|十二|[一二三四五六七八九十])\s*(?:[點点:：時])\s*(半|\d{1,2})?/g;

const ZH_HOURS: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
  十一: 11,
  十二: 12,
};

/** An evening clock hour (1–12) in 24h terms; 晚上12點 is midnight (24:00). */
function eveningHour(raw: string): number {
  const n = ZH_HOURS[raw] ?? Number(raw);
  return n <= 12 ? n + 12 : n;
}

/** Latest clock time mentioned in the text, in minutes from midnight, or null. */
export function latestMentionedMinutes(text: string): number | null {
  const times: number[] = [];
  for (const m of text.matchAll(CLOCK_24H)) times.push(Number(m[1]) * 60 + Number(m[2]));
  for (const m of text.matchAll(CLOCK_PM)) {
    const hour = Number(m[1]) % 12;
    times.push((hour + 12) * 60 + Number(m[2] ?? 0));
  }
  for (const m of text.matchAll(CLOCK_ZH_EVENING)) {
    const minutes = m[3] === "半" ? 30 : Number(m[3] ?? 0);
    times.push(eveningHour(m[2]) * 60 + minutes);
  }
  return times.length === 0 ? null : Math.max(...times);
}

function firstMatch(pattern: RegExp, text: string): string | null {
  const m = text.match(pattern);
  return m ? m[0].slice(0, 60) : null;
}

/** Screen one request. Pure: same input, same flags. */
export function screenCaseRequest(input: ScreenInput): ScreenResult {
  const text = [input.notes, input.district, input.targetSchool].filter(Boolean).join(" \n ");
  const hits: ScreenHit[] = [];

  const isAdultLearner = input.whoFor === "myself";
  // A venue hit holds only for adult learners (the #529 risk); for a child's
  // request it is a review flag, so a stray word never silently parks it.
  const location = firstMatch(HIGH_RISK_LOCATION, text);
  if (location) {
    hits.push({ flagType: "HIGH_RISK_LOCATION", hold: isAdultLearner, evidence: location });
  }

  const latest = latestMentionedMinutes(text);
  const wantsSpecificGender =
    input.preferredGender === "male" || input.preferredGender === "female";
  if (isAdultLearner && wantsSpecificGender && latest !== null && latest >= LATE_NIGHT_MINUTES) {
    const hh = String(Math.floor(latest / 60)).padStart(2, "0");
    const mm = String(latest % 60).padStart(2, "0");
    hits.push({ flagType: "LATE_NIGHT_ADULT", hold: true, evidence: `${hh}:${mm}` });
  }

  const scam = firstMatch(SCAM_OVERPAYMENT, text);
  if (scam) hits.push({ flagType: "SCAM_OVERPAYMENT", hold: true, evidence: scam });

  const bypass = firstMatch(BYPASS_COLLUSION, text);
  if (bypass) hits.push({ flagType: "BYPASS_COLLUSION_RISK", hold: false, evidence: bypass });

  const hopper = firstMatch(SERIAL_HOPPER, text);
  if (hopper) hits.push({ flagType: "SERIAL_HOPPER_PARENT", hold: false, evidence: hopper });

  return { hits, hold: hits.some((h) => h.hold) };
}

/** #529 serial hopper: this many early drops in the window flags the parent. */
export const SERIAL_HOPPER_DROPS = 3;
export const SERIAL_HOPPER_WINDOW_DAYS = 30;

/** True when the parent's recent early-drop timestamps reach the hopper bar. */
export function isSerialHopper(dropRecordedAt: readonly string[], now: Date): boolean {
  const since = now.getTime() - SERIAL_HOPPER_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recent = dropRecordedAt.filter((iso) => {
    const t = Date.parse(iso);
    return Number.isFinite(t) && t >= since;
  });
  return recent.length >= SERIAL_HOPPER_DROPS;
}

/** #529 T-12h ghost-risk window: L1 starts within this many hours, tutor unconfirmed. */
export const GHOST_RISK_HOURS = 12;

export function isGhostRisk(
  lesson: { startsAt: string; status: string; confirmedByTutorAt: string | null },
  now: Date,
): boolean {
  if (lesson.confirmedByTutorAt) return false;
  if (lesson.status !== "planned" && lesson.status !== "confirmed") return false;
  const startsIn = Date.parse(lesson.startsAt) - now.getTime();
  return startsIn > 0 && startsIn <= GHOST_RISK_HOURS * 60 * 60 * 1000;
}
