/**
 * Issue #204, slot derivation from weekly windows.
 *
 * Slots are NOT stored: they are derived from tutor_weekly_windows +
 * tutor_blackout_dates + live case_lessons at read time, so a weekly-hours
 * edit can never delete or mutate a confirmed lesson.
 */

import { F2F_BUFFER_MIN, hktDateKey, hktFromParts, hktWeekdayIndex } from "./sor";

export type WeeklyWindow = {
  weekday: number; // 0 = Monday (HKT)
  startMinute: number;
  endMinute: number;
  station?: string | null;
};

export type BlackoutDate = {
  blackout_date: string; // YYYY-MM-DD (HKT)
};

export type ExistingLesson = {
  starts_at: string; // ISO timestamp
  duration_min: number;
  /** Mirrors tutoring_cases.mode; in_person = F2F (buffer applies). */
  mode?: string | null;
};

export type GeneratedSlot = {
  startsAt: Date;
  durationMin: number;
  station: string | null;
};

export const SLOT_HORIZON_DAYS = 14;
export const DEFAULT_SLOT_MIN = 60;

/** Pure slot generator: fixed 60-minute slots inside each window, 14 days ahead (HKT). */
export function generateSlots(
  windows: WeeklyWindow[],
  blackouts: BlackoutDate[],
  existingLessons: ExistingLesson[],
  from: Date,
  now: Date,
  opts?: { durationMin?: number; horizonDays?: number },
): GeneratedSlot[] {
  const durationMin = opts?.durationMin ?? DEFAULT_SLOT_MIN;
  const horizonDays = opts?.horizonDays ?? SLOT_HORIZON_DAYS;
  if (windows.length === 0) return [];

  const blackoutSet = new Set(blackouts.map((b) => b.blackout_date));
  const slots: GeneratedSlot[] = [];

  for (let dayOffset = 0; dayOffset <= horizonDays; dayOffset++) {
    const dayStart = new Date(from.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const dateKey = hktDateKey(dayStart);
    if (blackoutSet.has(dateKey)) continue;
    const weekday = hktWeekdayIndex(dayStart);

    for (const w of windows) {
      if (w.weekday !== weekday) continue;
      const windowStart = hktFromParts(dateKey, w.startMinute);
      const windowEnd = hktFromParts(dateKey, w.endMinute);
      for (
        let t = windowStart.getTime();
        t + durationMin * 60 * 1000 <= windowEnd.getTime();
        t += durationMin * 60 * 1000
      ) {
        const startsAt = new Date(t);
        if (startsAt.getTime() <= now.getTime()) continue;
        if (lessonConflicts(startsAt, durationMin, existingLessons)) continue;
        slots.push({ startsAt, durationMin, station: w.station ?? null });
      }
    }
  }

  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/**
 * Overlap + F2F buffer check against already-booked lessons (the TS side of
 * the DB's hard double-book guard, the partial unique index only stops exact
 * same-instant doubles).
 */
export function lessonConflicts(
  startsAt: Date,
  durationMin: number,
  existing: ExistingLesson[],
  candidateMode: "f2f" | "online" = "f2f",
): boolean {
  const cStart = startsAt.getTime();
  const cEnd = cStart + durationMin * 60 * 1000;
  return existing.some((l) => {
    const eStart = Date.parse(l.starts_at);
    if (Number.isNaN(eStart)) return false;
    const eEnd = eStart + l.duration_min * 60 * 1000;
    const buffered =
      candidateMode === "f2f" && l.mode !== "online" ? F2F_BUFFER_MIN * 60 * 1000 : 0;
    return cStart < eEnd + buffered && eStart < cEnd + buffered;
  });
}
