/**
 * Issues #201 + #204, tutor-side pure helpers (week view grouping, window
 * validation, student-name privacy rule). No DB access; vitest-covered.
 */

import { isActiveStudentCase, lessonRequestExpired, type LessonStatus } from "@/features/cases/sor";
import { DEFAULT_TUTOR_TIMEZONE, dateKeyInZone } from "@/features/cases/tutor-timezone";

/** #201 tutor-list privacy: student FIRST NAME only. */
export function firstNameOf(studentName: string | null | undefined): string {
  const trimmed = (studentName ?? "").trim();
  if (!trimmed) return "Student";
  return trimmed.split(/\s+/)[0];
}

export type WindowInput = {
  weekday: number;
  start_minute: number;
  end_minute: number;
  station?: string | null;
};

/** Validate weekly windows before persisting (weekday 0=Mon HKT, 0–1440, start<end). */
export function validateWindows(windows: WindowInput[]): string[] {
  const errors: string[] = [];
  windows.forEach((w, i) => {
    if (!Number.isInteger(w.weekday) || w.weekday < 0 || w.weekday > 6) {
      errors.push(`window ${i}: weekday must be 0-6`);
    }
    if (!Number.isInteger(w.start_minute) || w.start_minute < 0 || w.start_minute > 1440) {
      errors.push(`window ${i}: start minute must be 0-1440`);
    }
    if (!Number.isInteger(w.end_minute) || w.end_minute < 0 || w.end_minute > 1440) {
      errors.push(`window ${i}: end minute must be 0-1440`);
    }
    if (
      Number.isInteger(w.start_minute) &&
      Number.isInteger(w.end_minute) &&
      w.start_minute >= w.end_minute
    ) {
      errors.push(`window ${i}: start must be before end`);
    }
  });
  return errors;
}

export type WeekLesson = {
  id: string;
  starts_at: string;
  duration_min: number;
  status: LessonStatus | string;
  case_code?: string | null;
  student?: string | null;
  station?: string | null;
  mode?: string | null;
};

export type WeekSlot = {
  startsAt: Date;
  durationMin: number;
  station: string | null;
};

export type WeekDayGroup = {
  dateKey: string; // YYYY-MM-DD HKT
  lessons: WeekLesson[];
  openSlots: WeekSlot[];
};

/** The calendar day `days` after a YYYY-MM-DD key, DST-proof by construction. */
export function addDaysToDateKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * #204 week view: booked lessons + open slots grouped by calendar day.
 * Slots overlapping (or within the buffer of) booked lessons never reach the
 * model, generateSlots already excludes them.
 *
 * #798: the day a lesson belongs to depends on the reader's zone, so the
 * bucket is derived from `zone` (the tutor's stored zone). Defaults to HKT,
 * which is byte-identical to the previous behaviour.
 */
export function groupWeekByDay(
  lessons: WeekLesson[],
  slots: WeekSlot[],
  from: Date,
  horizonDays: number,
  zone: string = DEFAULT_TUTOR_TIMEZONE,
): WeekDayGroup[] {
  const byDay = new Map<string, WeekDayGroup>();
  const startKey = dateKeyInZone(from, zone);
  for (let d = 0; d <= horizonDays; d++) {
    const key = addDaysToDateKey(startKey, d);
    byDay.set(key, { dateKey: key, lessons: [], openSlots: [] });
  }

  for (const l of lessons) {
    const key = dateKeyInZone(l.starts_at, zone);
    byDay.get(key)?.lessons.push(l);
  }
  for (const s of slots) {
    const key = dateKeyInZone(s.startsAt, zone);
    byDay.get(key)?.openSlots.push(s);
  }

  return [...byDay.values()].map((g) => ({
    ...g,
    lessons: [...g.lessons].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)),
    openSlots: [...g.openSlots].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
  }));
}

/** #204 Tutor Plus active-student count: cases whose lessons keep them active. */
export function countActiveStudents(
  casesLessons: { status: LessonStatus | string; starts_at: string }[][],
  now: Date,
): number {
  return casesLessons.filter((lessons) =>
    isActiveStudentCase(
      lessons.map((l) => ({ startsAt: new Date(l.starts_at), status: l.status as LessonStatus })),
      now,
    ),
  ).length;
}

/** Lesson action availability for the tutor UI (mirrors the server gates). */
export function lessonActionsFor(
  lesson: {
    starts_at: string;
    status: string;
    created_at?: string | null;
    no_request_expiry?: boolean | null;
  },
  now: Date,
  canMarkDone: (startsAt: Date, now: Date) => boolean,
): { confirm: boolean; decline: boolean; done: boolean; cancel: boolean } {
  const planned = lesson.status === "planned";
  const live = lesson.status === "planned" || lesson.status === "confirmed";
  // #204: a slot request unconfirmed for 12h has expired, hide the confirm/
  // decline affordances (the server fns refuse expired confirms regardless).
  const requestExpired = planned && lessonRequestExpired(lesson, now);
  return {
    confirm: planned && !requestExpired,
    decline: planned && !requestExpired,
    done:
      (lesson.status === "planned" || lesson.status === "confirmed") &&
      canMarkDone(new Date(lesson.starts_at), now),
    cancel: live,
  };
}
