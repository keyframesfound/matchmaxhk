/**
 * Issue #461 amendment (2026-10-28) — top-bar Calendar hub, pure half.
 *
 * One ops surface for tutors AND parents: upcoming lessons (with whom +
 * dual-confirm state), this month's scheduled count, and the lesson record
 * of previous months. Money stays in the tutor EarningsPanel (#461 3a);
 * parents never see the MatchMax admin fee (tutor-pays).
 */

export type HubLesson = {
  id: string;
  caseId: string;
  caseCode: string;
  startsAt: string;
  durationMin: number;
  status: string;
  /** Tutor view: student first name. Parent view: tutor display name. */
  counterpart: string;
  confirmedByTutor: boolean;
  confirmedByParent: boolean;
};

export type ConfirmState = "both" | "tutor_only" | "parent_only" | "none";

export type MonthRecord = { month: string; lessons: number; hours: number };

export type CalendarSummary = {
  upcoming: HubLesson[];
  thisMonthScheduled: number;
  history: MonthRecord[];
};

const HKT_OFFSET_MS = 8 * 60 * 60 * 1000;
export const HUB_HISTORY_MONTHS = 3;
export const HUB_UPCOMING_LIMIT = 20;
const LIVE = new Set(["planned", "confirmed"]);

/** "YYYY-MM" of an instant in Hong Kong time. */
export function hktMonthKey(iso: string | Date): string {
  const ms = typeof iso === "string" ? Date.parse(iso) : iso.getTime();
  const d = new Date(ms + HKT_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function previousMonthKeys(now: Date, count: number): string[] {
  const d = new Date(now.getTime() + HKT_OFFSET_MS);
  const keys: string[] = [];
  for (let i = 1; i <= count; i++) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    keys.push(`${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

export function confirmState(
  l: Pick<HubLesson, "confirmedByTutor" | "confirmedByParent">,
): ConfirmState {
  if (l.confirmedByTutor && l.confirmedByParent) return "both";
  if (l.confirmedByTutor) return "tutor_only";
  if (l.confirmedByParent) return "parent_only";
  return "none";
}

export function summarizeCalendar(lessons: readonly HubLesson[], now: Date): CalendarSummary {
  const nowMs = now.getTime();
  const thisMonth = hktMonthKey(now);
  const upcoming = lessons
    .filter((l) => LIVE.has(l.status) && Date.parse(l.startsAt) >= nowMs)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const thisMonthScheduled = lessons.filter(
    (l) => (LIVE.has(l.status) || l.status === "done") && hktMonthKey(l.startsAt) === thisMonth,
  ).length;
  const history = previousMonthKeys(now, HUB_HISTORY_MONTHS).map((month) => {
    const done = lessons.filter((l) => l.status === "done" && hktMonthKey(l.startsAt) === month);
    const minutes = done.reduce((sum, l) => sum + Math.max(0, l.durationMin), 0);
    return { month, lessons: done.length, hours: Math.round((minutes / 60) * 10) / 10 };
  });
  return { upcoming: upcoming.slice(0, HUB_UPCOMING_LIMIT), thisMonthScheduled, history };
}
