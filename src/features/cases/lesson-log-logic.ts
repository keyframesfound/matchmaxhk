/**
 * Issue #796 §2.5 — Lesson Log / 課堂紀錄 timeline, pure half.
 *
 * The Super-Drawer (#767) writes one `case_lesson_logs` row per verified
 * lesson; nothing reads them back as a chronologic feed until here. This module
 * owns the row assembly the server fn and the Case Workspace UI share
 * (vitest-covered): joining a log to its `case_lessons` row, "Lesson #N"
 * numbering (`sequence`, else starts_at position), the hours-only flag and the
 * pulse label keys.
 *
 * Hours-only is `topics.length === 0`, never `recap_status`: a full sync with no
 * tag also lands 'incomplete', so the status alone cannot tell the two apart.
 *
 * Deliberately absent: `logged_by` and `recap` never reach this shape — the feed
 * is a summary, not the private write surface.
 */

import { parseDrawerTopics } from "@/features/cases/heatmap-logic";
import type { DrawerLogRow, DrawerTopic } from "@/features/cases/super-drawer/super-drawer-logic";

/** One timeline entry as the UI renders it. */
export type LessonLogRow = {
  id: string;
  lessonId: string;
  /** 1-based "Lesson #N". */
  lessonNumber: number;
  startsAt: string;
  durationMin: number;
  topics: DrawerTopic[];
  /** Log Hours Only: no #tag was captured (the [ Add Recap & Tags ] state). */
  hoursOnly: boolean;
  /** i18n keys for punctuality, focus, prep — missing/unknown values skipped. */
  pulseKeys: string[];
};

/** The `case_lessons` slice the feed needs — nothing calendar-facing. */
export type LessonLogLesson = {
  id: string;
  sequence: number | null;
  starts_at: string;
  duration_min: number;
};

/** Server payload shape; the UI agent renders `rows` in order. */
export type LessonLogFeed = {
  rows: LessonLogRow[];
};

/**
 * Stored pulse values -> `super_drawer.pulse_*` i18n keys. Each value appears in
 * exactly one pulse row, so one flat table cannot collide.
 */
const PULSE_KEY_BY_VALUE: Record<string, string> = {
  on_time: "super_drawer.pulse_on_time",
  late: "super_drawer.pulse_late",
  attentive: "super_drawer.pulse_attentive",
  good: "super_drawer.pulse_good",
  distracted: "super_drawer.pulse_distracted",
  prepared: "super_drawer.pulse_prepared",
  partial: "super_drawer.pulse_partial",
  none: "super_drawer.pulse_none",
};

/** One stored pulse value -> its label key; null for anything unrecognised. */
export function pulseKeyFor(value: string): string | null {
  if (typeof value !== "string") return null;
  return PULSE_KEY_BY_VALUE[value.trim().toLowerCase()] ?? null;
}

/** Punctuality -> focus -> prep, skipping whatever the log does not carry. */
function pulseKeysFor(pulse: unknown): string[] {
  const record =
    pulse && typeof pulse === "object" ? (pulse as Record<string, unknown>) : ({} as const);
  const keys: string[] = [];
  for (const raw of [record.punctuality, record.focus, record.prep_hw]) {
    const key = typeof raw === "string" ? pulseKeyFor(raw) : null;
    if (key) keys.push(key);
  }
  return keys;
}

/** Milliseconds for ordering; unparseable dates sort last, never first. */
function timeOf(value: string | null | undefined): number {
  const ms = Date.parse(value ?? "");
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

/** Descending comparator that treats two unknowns as equal (Infinity - Infinity). */
function compareDesc(a: number, b: number): number {
  if (a === b) return 0;
  return a > b ? -1 : 1;
}

/** `sequence` wins; otherwise the lesson's 1-based starts_at position. */
function lessonNumberFor(sequence: number | null, position: number): number {
  if (typeof sequence === "number" && Number.isFinite(sequence) && sequence > 0) {
    return Math.trunc(sequence);
  }
  return position;
}

/** DB int -> positive minutes; anything unusable becomes 0 (unknown length). */
function durationOf(value: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

type Pending = {
  row: LessonLogRow;
  /** Sort keys kept off the payload. */
  startMs: number;
  createdMs: number;
};

/**
 * Join logs to their lessons and return the timeline the UI shows.
 *
 * Rules:
 *  - newest first by the LESSON's starts_at (the class date, not the tap date),
 *    tie-broken by the log's created_at then id;
 *  - lessonNumber = sequence, else the lesson's position when the case's
 *    lessons are ordered by starts_at ascending;
 *  - hoursOnly = no topics;
 *  - a log whose lesson row is missing is dropped, never given a fake date.
 */
export function buildLessonLogRows(
  logs: readonly DrawerLogRow[],
  lessons: readonly LessonLogLesson[],
): LessonLogRow[] {
  const byId = new Map<string, { lesson: LessonLogLesson; position: number; startMs: number }>();
  [...lessons]
    .map((lesson, index) => ({ lesson, index, startMs: timeOf(lesson.starts_at) }))
    .sort((a, b) => {
      const byStart = a.startMs === b.startMs ? 0 : a.startMs - b.startMs;
      return byStart !== 0 ? byStart : a.index - b.index;
    })
    .forEach(({ lesson, startMs }, index) => {
      // First occurrence wins; duplicate ids are a data bug, not a numbering one.
      if (!byId.has(lesson.id)) {
        byId.set(lesson.id, { lesson, position: index + 1, startMs });
      }
    });

  const pending: Pending[] = [];
  for (const log of logs) {
    const match = byId.get(log.lesson_id);
    if (!match) continue;
    const topics = parseDrawerTopics(log.topics);
    pending.push({
      row: {
        id: log.id,
        lessonId: match.lesson.id,
        lessonNumber: lessonNumberFor(match.lesson.sequence, match.position),
        startsAt: match.lesson.starts_at,
        durationMin: durationOf(match.lesson.duration_min),
        topics,
        hoursOnly: topics.length === 0,
        // A Log Hours Only entry carries the drawer's pre-selected pulse, which
        // was never an assessment. Showing it would imply a graded log, so the
        // hours-only row reports hours and nothing else.
        pulseKeys: topics.length === 0 ? [] : pulseKeysFor(log.pulse),
      },
      startMs: match.startMs,
      createdMs: timeOf(log.created_at),
    });
  }

  pending.sort((a, b) => {
    const byStart = compareDesc(a.startMs, b.startMs);
    if (byStart !== 0) return byStart;
    const byCreated = compareDesc(a.createdMs, b.createdMs);
    if (byCreated !== 0) return byCreated;
    return a.row.id.localeCompare(b.row.id);
  });

  return pending.map((entry) => entry.row);
}
