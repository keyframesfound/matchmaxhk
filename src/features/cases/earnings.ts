/**
 * Issue #461 Phase A — tutor earnings buckets for the dashboard.
 *
 * Pure: case rows in, whole-HKD totals out. Fee per lesson follows the #536
 * SoT (fee-drop.ts), not the older #461 draft: R is the case's locked hourly
 * rate × student count, the first DONE lesson carries the L1 portion and the
 * second the rest of the tier's base. Reschedules and cancellations never
 * spend a fee slot because order comes from done/upcoming lessons only.
 *
 * Buckets (tutor-side, net of the MatchMax admin fee the tutor pays):
 * - Realized: done lessons + pending/verified #387 session logs in range
 * - Pipeline: planned/confirmed lessons still ahead of `now`, in range
 * - Forecast: Realized + Pipeline
 * - Admin fee: the admin fee on those same lessons
 * Pending tuition collection needs a schema flag and lands in #461 3b.
 */

import {
  lessonOnePortion,
  tierBaseMultiplier,
  type SecondaryTier,
  type SplitMode,
} from "@/features/cases/fee-drop";
import { SHORT_CASE_FEE_RATE } from "@/features/cases/short-case";
import { hktDateKey, hktFromParts, hktWeekdayIndex } from "@/features/cases/sor";

export type EarningsLessonInput = {
  id: string;
  sequence: number;
  startsAt: string;
  durationMin: number;
  status: string;
};

export type EarningsSessionLogInput = {
  id: string;
  logDate: string;
  startMinute: number;
  durationMin: number;
  status: string;
};

export type EarningsCaseInput = {
  caseId: string;
  caseCode: string;
  studentLabel: string;
  hourlyRateHkd: number | null;
  studentCount: number;
  packageType: string | null;
  tier: SecondaryTier;
  splitMode: SplitMode;
  feeRuleId: string | null;
  lessons: EarningsLessonInput[];
  sessionLogs: EarningsSessionLogInput[];
};

export type EarningsBucket = "realized" | "pipeline";

export type EarningsLesson = {
  id: string;
  source: "lesson" | "session_log";
  startsAt: string;
  durationMin: number;
  bucket: EarningsBucket;
  /** 1-based fee order among done/upcoming lessons; null for session logs. */
  feeOrder: number | null;
  grossHkd: number;
  adminHkd: number;
  netHkd: number;
};

export type EarningsTotals = {
  realizedHkd: number;
  pipelineHkd: number;
  forecastHkd: number;
  adminHkd: number;
  realizedHours: number;
};

export type EarningsCase = {
  caseId: string;
  caseCode: string;
  studentLabel: string;
  missingRate: boolean;
  lessons: EarningsLesson[];
  totals: EarningsTotals;
};

export type EarningsResult = {
  cases: EarningsCase[];
  totals: EarningsTotals;
  casesMissingRate: number;
};

export type EarningsRangeKind = "week" | "month";
export type EarningsRange = { from: Date; to: Date };

const DONE_STATUSES = new Set(["done"]);
const UPCOMING_STATUSES = new Set(["planned", "confirmed"]);
const COUNTED_LOG_STATUSES = new Set(["pending", "verified"]);
const FEE_FREE_RULES = new Set(["OWNERSHIP_EXPIRED", "PRO_BONO"]);
const MINUTES_PER_HOUR = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

const ZERO_TOTALS: EarningsTotals = {
  realizedHkd: 0,
  pipelineHkd: 0,
  forecastHkd: 0,
  adminHkd: 0,
  realizedHours: 0,
};

/** tutoring_cases.secondary_tier_applied text → ladder tier; unknown → primary. */
export function parseSecondaryTier(value: string | null | undefined): SecondaryTier {
  const n = Number(value);
  return n === 1 || n === 2 || n === 3 || n === 4 ? n : "primary";
}

/** HKT calendar week (Mon 00:00 → next Mon) or month containing `now`. */
export function earningsRange(kind: EarningsRangeKind, now: Date): EarningsRange {
  const todayKey = hktDateKey(now);
  if (kind === "week") {
    const today = hktFromParts(todayKey, 0);
    const from = new Date(today.getTime() - hktWeekdayIndex(now) * DAY_MS);
    return { from, to: new Date(from.getTime() + 7 * DAY_MS) };
  }
  const [year, month] = todayKey.split("-").map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    from: hktFromParts(`${year}-${pad(month)}-01`, 0),
    to: hktFromParts(`${nextYear}-${pad(nextMonth)}-01`, 0),
  };
}

/** Admin fee on the Nth done/upcoming lesson of a case (whole HKD). */
function adminFor(
  c: EarningsCaseInput,
  feeOrder: number,
  grossHkd: number,
  lessonValueHkd: number,
): number {
  if (c.packageType === "pro_bono" || (c.feeRuleId && FEE_FREE_RULES.has(c.feeRuleId))) return 0;
  if (c.packageType === "short_20") return Math.round(grossHkd * SHORT_CASE_FEE_RATE);
  const total = Math.round(tierBaseMultiplier(c.tier) * lessonValueHkd);
  const first = Math.min(total, Math.round(lessonOnePortion(c.splitMode) * lessonValueHkd));
  if (feeOrder === 1) return first;
  if (feeOrder === 2) return total - first;
  return 0;
}

function sumTotals(lessons: readonly EarningsLesson[]): EarningsTotals {
  const realized = lessons.filter((l) => l.bucket === "realized");
  const realizedHkd = realized.reduce((s, l) => s + l.netHkd, 0);
  const pipelineHkd = lessons
    .filter((l) => l.bucket === "pipeline")
    .reduce((s, l) => s + l.netHkd, 0);
  const realizedMinutes = realized.reduce((s, l) => s + l.durationMin, 0);
  return {
    realizedHkd,
    pipelineHkd,
    forecastHkd: realizedHkd + pipelineHkd,
    adminHkd: lessons.reduce((s, l) => s + l.adminHkd, 0),
    realizedHours: Math.round((realizedMinutes / MINUTES_PER_HOUR) * 100) / 100,
  };
}

function addTotals(a: EarningsTotals, b: EarningsTotals): EarningsTotals {
  return {
    realizedHkd: a.realizedHkd + b.realizedHkd,
    pipelineHkd: a.pipelineHkd + b.pipelineHkd,
    forecastHkd: a.forecastHkd + b.forecastHkd,
    adminHkd: a.adminHkd + b.adminHkd,
    realizedHours: Math.round((a.realizedHours + b.realizedHours) * 100) / 100,
  };
}

const byStart = (a: { startsAt: string }, b: { startsAt: string }) =>
  Date.parse(a.startsAt) - Date.parse(b.startsAt);

function caseHeader(
  c: EarningsCaseInput,
): Pick<EarningsCase, "caseId" | "caseCode" | "studentLabel"> {
  return { caseId: c.caseId, caseCode: c.caseCode, studentLabel: c.studentLabel };
}

function caseEarnings(c: EarningsCaseInput, range: EarningsRange, now: Date): EarningsCase {
  const rate = Number(c.hourlyRateHkd);
  if (c.hourlyRateHkd == null || !Number.isFinite(rate) || rate <= 0) {
    return { ...caseHeader(c), missingRate: true, lessons: [], totals: ZERO_TOTALS };
  }
  const students = Number.isInteger(c.studentCount) && c.studentCount >= 1 ? c.studentCount : 1;
  const lessonValueHkd = rate * students;
  const grossFor = (minutes: number) => Math.round((lessonValueHkd * minutes) / MINUTES_PER_HOUR);
  const inRange = (iso: string) => {
    const t = Date.parse(iso);
    return t >= range.from.getTime() && t < range.to.getTime();
  };

  const done = c.lessons.filter((l) => DONE_STATUSES.has(l.status)).sort(byStart);
  const upcoming = c.lessons
    .filter((l) => UPCOMING_STATUSES.has(l.status) && Date.parse(l.startsAt) >= now.getTime())
    .sort(byStart);
  const ordered = [
    ...done.map((l) => ({ l, bucket: "realized" as const })),
    ...upcoming.map((l) => ({ l, bucket: "pipeline" as const })),
  ];
  const lessonRows: EarningsLesson[] = ordered.flatMap(({ l, bucket }, i) => {
    if (!inRange(l.startsAt)) return [];
    const grossHkd = grossFor(l.durationMin);
    const adminHkd = adminFor(c, i + 1, grossHkd, lessonValueHkd);
    return [
      {
        id: l.id,
        source: "lesson" as const,
        startsAt: l.startsAt,
        durationMin: l.durationMin,
        bucket,
        feeOrder: i + 1,
        grossHkd,
        adminHkd,
        netHkd: grossHkd - adminHkd,
      },
    ];
  });

  // #387 logs are lesson 3+ on fee-paid cases, so they never carry admin.
  // Skip a log on a day that already has a done lesson: same lesson twice.
  const doneDays = new Set(done.map((l) => hktDateKey(new Date(l.startsAt))));
  const logRows: EarningsLesson[] = c.sessionLogs.flatMap((s) => {
    if (!COUNTED_LOG_STATUSES.has(s.status) || doneDays.has(s.logDate)) return [];
    const startsAt = hktFromParts(s.logDate, s.startMinute).toISOString();
    if (!inRange(startsAt)) return [];
    const grossHkd = grossFor(s.durationMin);
    return [
      {
        id: s.id,
        source: "session_log" as const,
        startsAt,
        durationMin: s.durationMin,
        bucket: "realized" as const,
        feeOrder: null,
        grossHkd,
        adminHkd: 0,
        netHkd: grossHkd,
      },
    ];
  });

  const lessons = [...lessonRows, ...logRows].sort(byStart);
  return { ...caseHeader(c), missingRate: false, lessons, totals: sumTotals(lessons) };
}

export function computeEarnings(
  cases: readonly EarningsCaseInput[],
  range: EarningsRange,
  now: Date,
): EarningsResult {
  const perCase = cases.map((c) => caseEarnings(c, range, now));
  return {
    cases: perCase,
    totals: perCase.reduce((acc, c) => addTotals(acc, c.totals), ZERO_TOTALS),
    casesMissingRate: perCase.filter((c) => c.missingRate).length,
  };
}
