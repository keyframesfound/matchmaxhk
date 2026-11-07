/**
 * Issue #636: thin schedule sync, pure half.
 *
 * case_lessons is the single schedule store. A weekly series is ordinary
 * lesson rows sharing a series_id, so every existing rule (dual confirm, the
 * time-clash trigger, ledgers) keeps working. Soft preferences stay on
 * tutoring_cases.schedule_slots and never become lessons on their own.
 */

import { lessonConflicts, type ExistingLesson } from "@/features/cases/slot";
import { SCHEDULE_MAX_AHEAD_DAYS } from "@/features/cases/schedule-lesson";
import { hktDateKey, hktFromParts, hktWeekdayIndex } from "@/features/cases/sor";

export const SERIES_WEEK_CHOICES = [4, 8, 12] as const;
export const SERIES_MAX_WEEKS = 12;
export const SERIES_MAX_LESSONS = 36;
/** A released proposal still explains a Schedule Updated tag for this long. */
export const RELEASED_SLOT_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;
const HKT_OFFSET_MS = 8 * 60 * 60 * 1000;
const WEEK_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const AFTERNOON_START_MIN = 12 * 60;
const EVENING_START_MIN = 18 * 60;
const CASE_CODE_PATTERN = /^[A-Z]{1,4}-[A-Za-z0-9]{1,12}$/;

const OCCUPIED_STATUSES: ReadonlySet<string> = new Set(["planned", "confirmed", "done"]);
const LIVE_STATUSES: ReadonlySet<string> = new Set(["planned", "confirmed"]);

/** The shared schedule-state tokens; every surface uses these labels and classes. */
export const SCHEDULE_STATES = ["occupied", "proposed", "blocked", "open"] as const;
export type ScheduleState = (typeof SCHEDULE_STATES)[number];

export type EditScope = "one" | "selected" | "series";

export type ScheduleLesson = {
  id: string;
  caseId: string;
  startsAt: string;
  durationMin: number;
  status: string;
  seriesId: string | null;
};

export type PrefSlot = { day: string; period: string };

export type PendingCase = { caseId: string; scheduleMode: string | null; slots: unknown };

/** The drawer tabs; `?tab=` falls back to overview. */
export type CaseTab = "overview" | "homework" | "progress" | "schedule";

export function caseTabFromParam(value: unknown): CaseTab {
  return value === "homework" || value === "progress" || value === "schedule" ? value : "overview";
}

/** The `?case=` value, normalised, or null when it cannot be a case code. */
export function caseCodeFromParam(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().replace(/^#/, "");
  return CASE_CODE_PATTERN.test(code) ? code : null;
}

/** "HH:mm" in Hong Kong time, whatever the browser's timezone is. */
export function hktClock(iso: string): string {
  return new Date(Date.parse(iso) + HKT_OFFSET_MS).toISOString().slice(11, 16);
}

/** Minutes from HKT midnight. */
export function hktMinuteOfDay(iso: string): number {
  const shifted = new Date(Date.parse(iso) + HKT_OFFSET_MS);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

/** "Tue, 10 Nov" in Hong Kong time, in the reader's language. */
export function hktDayLabel(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Hong_Kong",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

/** Lesson starts for a weekly pattern, inside (now, now + 90 days]. */
export function buildWeeklySeries(input: {
  firstDateKey: string;
  weekdays: readonly number[];
  minuteOfDay: number;
  weeks: number;
  now: Date;
}): string[] {
  const { firstDateKey, weekdays, minuteOfDay, weeks, now } = input;
  const days = new Set(weekdays);
  if (days.size === 0) return [];
  const limit = now.getTime() + SCHEDULE_MAX_AHEAD_DAYS * DAY_MS;
  const firstMs = hktFromParts(firstDateKey, minuteOfDay).getTime();
  const weekStartMs = firstMs - hktWeekdayIndex(new Date(firstMs)) * DAY_MS;
  const starts: string[] = [];
  for (let offset = 0; offset < weeks * 7; offset += 1) {
    const ms = weekStartMs + offset * DAY_MS;
    if (ms < firstMs || ms <= now.getTime() || ms > limit) continue;
    if (days.has(hktWeekdayIndex(new Date(ms)))) starts.push(new Date(ms).toISOString());
  }
  return starts.slice(0, SERIES_MAX_LESSONS);
}

/** Splits a series into free and clashing starts; clashes are reported, not fatal. */
export function partitionSeriesClashes(
  starts: readonly string[],
  durationMin: number,
  online: boolean,
  existing: readonly ExistingLesson[],
): { free: string[]; clashes: string[] } {
  const mode = online ? "online" : "in_person";
  const taken: ExistingLesson[] = [...existing];
  const free: string[] = [];
  const clashes: string[] = [];
  for (const start of starts) {
    if (lessonConflicts(new Date(start), durationMin, taken, online ? "online" : "f2f")) {
      clashes.push(start);
    } else {
      free.push(start);
      taken.push({ starts_at: start, duration_min: durationMin, mode });
    }
  }
  return { free, clashes };
}

/** Pre-fills the weekly form from the case's latest kept lesson. */
export function seriesPrefill(
  lessons: readonly ScheduleLesson[],
  now: Date,
): { firstDateKey: string; weekday: number; minuteOfDay: number; durationMin: number } | null {
  const kept = lessons.filter((l) => OCCUPIED_STATUSES.has(l.status));
  if (kept.length === 0) return null;
  const latest = kept.reduce((a, b) => (Date.parse(b.startsAt) > Date.parse(a.startsAt) ? b : a));
  let ms = Date.parse(latest.startsAt) + 7 * DAY_MS;
  while (ms <= now.getTime()) ms += 7 * DAY_MS;
  const next = new Date(ms);
  return {
    firstDateKey: hktDateKey(next),
    weekday: hktWeekdayIndex(next),
    minuteOfDay: hktMinuteOfDay(latest.startsAt),
    durationMin: latest.durationMin,
  };
}

/** The lessons an edit may touch: live, future and on this case, oldest first. */
export function targetsForEdit(
  lessons: readonly ScheduleLesson[],
  caseId: string,
  lessonIds: readonly string[],
  scope: EditScope,
  now: Date,
): ScheduleLesson[] {
  if (scope === "one" && lessonIds.length !== 1) return [];
  const editable = lessons
    .filter(
      (l) =>
        l.caseId === caseId &&
        LIVE_STATUSES.has(l.status) &&
        Date.parse(l.startsAt) > now.getTime(),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const ids = new Set(lessonIds);
  if (scope !== "series") return editable.filter((l) => ids.has(l.id));
  const seriesIds = new Set(
    lessons.filter((l) => ids.has(l.id) && l.seriesId).map((l) => l.seriesId),
  );
  return editable.filter((l) => ids.has(l.id) || (l.seriesId && seriesIds.has(l.seriesId)));
}

/** New start after moving `dayDelta` days and optionally setting the HKT time. */
export function shiftedStart(
  startsAt: string,
  change: { dayDelta: number; minuteOfDay?: number },
): string {
  const minute = change.minuteOfDay ?? hktMinuteOfDay(startsAt);
  const moved = hktFromParts(hktDateKey(new Date(startsAt)), minute);
  return new Date(moved.getTime() + change.dayDelta * DAY_MS).toISOString();
}

/** Write order that stops a shifted series from clashing with its own rows. */
export function orderForShift<T extends { startsAt: string }>(
  lessons: readonly T[],
  dayDelta: number,
): T[] {
  const sorted = [...lessons].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return dayDelta > 0 ? sorted.reverse() : sorted;
}

export function nextLessonFor(
  lessons: readonly ScheduleLesson[],
  caseId: string,
  now: Date,
): ScheduleLesson | null {
  const upcoming = lessons
    .filter(
      (l) =>
        l.caseId === caseId &&
        LIVE_STATUSES.has(l.status) &&
        Date.parse(l.startsAt) > now.getTime(),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return upcoming[0] ?? null;
}

/** Next live start from raw lesson rows, for case cards outside the hub. */
export function nextLiveStart(
  lessons: readonly { starts_at: string; status: string }[],
  now: Date,
): string | null {
  const starts = lessons
    .filter((l) => LIVE_STATUSES.has(l.status) && Date.parse(l.starts_at) > now.getTime())
    .map((l) => l.starts_at)
    .sort((a, b) => a.localeCompare(b));
  return starts[0] ?? null;
}

/** Thin Calendar chips by HKT day. Only real lessons paint; prefs never do. */
export function chipsByHktDay<T extends ScheduleLesson>(lessons: readonly T[]): Map<string, T[]> {
  const days = new Map<string, T[]>();
  const painted = lessons
    .filter((l) => OCCUPIED_STATUSES.has(l.status))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  for (const lesson of painted) {
    const key = hktDateKey(new Date(lesson.startsAt));
    days.set(key, [...(days.get(key) ?? []), lesson]);
  }
  return days;
}

export function periodOfMinute(minute: number): string {
  if (minute < AFTERNOON_START_MIN) return "morning";
  return minute < EVENING_START_MIN ? "afternoon" : "evening";
}

export function readSlots(value: unknown): PrefSlot[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (s): s is PrefSlot =>
      typeof s === "object" &&
      s !== null &&
      typeof (s as PrefSlot).day === "string" &&
      typeof (s as PrefSlot).period === "string",
  );
}

/** Preferred slots that a live lesson now sits on (weekday + period, HKT). */
export function overlappedPrefSlots(
  slots: unknown,
  lessons: readonly ScheduleLesson[],
): PrefSlot[] {
  const taken = new Set(
    lessons
      .filter((l) => LIVE_STATUSES.has(l.status))
      .map((l) => {
        const at = new Date(l.startsAt);
        return `${WEEK_DAYS[hktWeekdayIndex(at)]}-${periodOfMinute(hktMinuteOfDay(l.startsAt))}`;
      }),
  );
  return readSlots(slots).filter((s) => taken.has(`${s.day}-${s.period}`));
}

/**
 * Pending cases to tag Schedule Updated: a slot they shared became occupied,
 * or another proposal holding it was released. Computed on each load, so dead
 * proposals never leave a stale warning behind. Flexible cases hold no slot.
 */
export function scheduleUpdatedCaseIds(
  pending: readonly PendingCase[],
  lessons: readonly ScheduleLesson[],
  releasedSlots: unknown = [],
): string[] {
  const released = new Set(readSlots(releasedSlots).map((s) => `${s.day}-${s.period}`));
  return pending
    .filter((p) => {
      if (p.scheduleMode === "flexible") return false;
      if (overlappedPrefSlots(p.slots, lessons).length > 0) return true;
      return readSlots(p.slots).some((s) => released.has(`${s.day}-${s.period}`));
    })
    .map((p) => p.caseId);
}
