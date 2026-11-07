/**
 * Issue #654: Schedule & Billing, pure half. The statement is bookkeeping for
 * tuition the parent and independent tutor settle directly (Cap.57): nothing
 * here moves money, holds funds or changes the admin fee.
 */

import { hktMonthKey } from "@/features/cases/calendar-hub";

export const RESCHEDULE_NOTE_MAX = 200;
export const STATEMENT_NOTE_MAX = 200;
export const SHARE_COOLDOWN_MS = 60 * 60 * 1000;
export const STATEMENT_STATUSES = ["unpaid", "paid", "partial"] as const;

const BILLABLE_STATUSES: ReadonlySet<string> = new Set(["planned", "confirmed", "done"]);
const LIVE_STATUSES: ReadonlySet<string> = new Set(["planned", "confirmed"]);
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export type StatementStatus = (typeof STATEMENT_STATUSES)[number];
export type BillingRole = "tutor" | "parent";

export type StatementLesson = {
  id: string;
  startsAt: string;
  durationMin: number;
  status: string;
};

export type MonthMark = {
  month: string;
  status: StatementStatus;
  note: string | null;
  markedByRole: BillingRole | null;
  markedAt: string | null;
};

export type StatementLine = StatementLesson & { hours: number; lineTotal: number | null };

export type StatementMonth = {
  month: string;
  lessons: number;
  hours: number;
  total: number | null;
  status: StatementStatus;
  note: string | null;
  markedByRole: BillingRole | null;
  markedAt: string | null;
  lines: StatementLine[];
};

export type Statement = { months: StatementMonth[]; caseTotal: number | null };

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isStatementMonth(value: string): boolean {
  return MONTH_PATTERN.test(value);
}

export function buildStatement(
  lessons: readonly StatementLesson[],
  terms: { rateHkd: number | null; studentCount: number | null },
  marks: readonly MonthMark[],
): Statement {
  const { rateHkd } = terms;
  const students = Math.max(terms.studentCount ?? 1, 1);
  const lines = lessons
    .filter((l) => BILLABLE_STATUSES.has(l.status))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((l) => ({
      ...l,
      hours: l.durationMin / 60,
      lineTotal: rateHkd === null ? null : roundMoney((rateHkd * students * l.durationMin) / 60),
    }));
  const keys = [...new Set(lines.map((l) => hktMonthKey(l.startsAt)))].sort().reverse();
  const months = keys.map((month) => {
    const monthLines = lines.filter((l) => hktMonthKey(l.startsAt) === month);
    const mark = marks.find((m) => m.month === month);
    return {
      month,
      lessons: monthLines.length,
      hours: monthLines.reduce((sum, l) => sum + l.durationMin, 0) / 60,
      total:
        rateHkd === null
          ? null
          : roundMoney(monthLines.reduce((s, l) => s + (l.lineTotal ?? 0), 0)),
      status: mark?.status ?? "unpaid",
      note: mark?.note ?? null,
      markedByRole: mark?.markedByRole ?? null,
      markedAt: mark?.markedAt ?? null,
      lines: monthLines,
    };
  });
  return {
    months,
    caseTotal: rateHkd === null ? null : roundMoney(months.reduce((s, m) => s + (m.total ?? 0), 0)),
  };
}

export type RescheduleError = "LESSON_NOT_LIVE" | "LESSON_PAST" | "IN_PAST" | "SAME_TIME";

export function rescheduleLessonError(input: {
  lesson: { startsAt: string; status: string };
  proposedIso: string;
  now: Date;
}): RescheduleError | null {
  const { lesson, proposedIso, now } = input;
  if (!LIVE_STATUSES.has(lesson.status)) return "LESSON_NOT_LIVE";
  if (Date.parse(lesson.startsAt) <= now.getTime()) return "LESSON_PAST";
  if (Date.parse(proposedIso) <= now.getTime()) return "IN_PAST";
  if (Date.parse(proposedIso) === Date.parse(lesson.startsAt)) return "SAME_TIME";
  return null;
}

export function canRespondToReschedule(
  request: { status: string; proposerRole: BillingRole },
  role: BillingRole,
): boolean {
  return request.status === "pending" && request.proposerRole !== role;
}
