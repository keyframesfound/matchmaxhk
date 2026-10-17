/**
 * Issues #201 + #204 — tutor-side pure helpers (week view grouping, window
 * validation, student-name privacy rule). No DB access; vitest-covered.
 */

import { hktDateKey, isActiveStudentCase, type LessonStatus } from "@/features/cases/sor";

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

/**
 * #204 week view: booked lessons + open slots grouped by HKT calendar day.
 * Slots overlapping (or within the buffer of) booked lessons never reach the
 * model — generateSlots already excludes them.
 */
export function groupWeekByDay(
  lessons: WeekLesson[],
  slots: WeekSlot[],
  from: Date,
  horizonDays: number,
): WeekDayGroup[] {
  const byDay = new Map<string, WeekDayGroup>();
  for (let d = 0; d <= horizonDays; d++) {
    const key = hktDateKey(new Date(from.getTime() + d * 86400000));
    byDay.set(key, { dateKey: key, lessons: [], openSlots: [] });
  }

  for (const l of lessons) {
    const key = hktDateKey(new Date(l.starts_at));
    byDay.get(key)?.lessons.push(l);
  }
  for (const s of slots) {
    const key = hktDateKey(s.startsAt);
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
  lesson: { starts_at: string; status: string },
  now: Date,
  canMarkDone: (startsAt: Date, now: Date) => boolean,
): { confirm: boolean; decline: boolean; done: boolean; cancel: boolean } {
  const planned = lesson.status === "planned";
  const live = lesson.status === "planned" || lesson.status === "confirmed";
  return {
    confirm: planned,
    decline: planned,
    done:
      (lesson.status === "planned" || lesson.status === "confirmed") &&
      canMarkDone(new Date(lesson.starts_at), now),
    cancel: live,
  };
}
