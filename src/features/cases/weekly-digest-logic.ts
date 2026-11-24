/**
 * Issue #796 §2.6 (was #742) — weekly learning digest, pure half.
 *
 * The digest is the Monday-to-Sunday snapshot the learner side (parent or
 * student owner) receives for one case. It has no storage of its own: every
 * number is derived from rows that already exist at read time —
 *
 *  - verified lessons + hours: `case_lessons` through the ONE shared predicate
 *    (`isEligibleReviewLesson`) and the ONE shared counter
 *    (`completedLessonCount`), so a lesson that cannot unlock a rating can
 *    never inflate the digest;
 *  - recaps: `case_lesson_logs.recap` rows created inside the window;
 *  - homework: `case_homework.submitted_at` inside the window;
 *  - mistakes mastered: `case_mistakes.status = 'mastered'` with `mastered_at`
 *    inside the window;
 *  - mastery + focus: `buildTopicCells` over the case's logs and unresolved
 *    mistake tags — the #796 §2.1 heatmap is the single mastery definition.
 *
 * Window rule (HKT = UTC+8, no DST, never the host timezone): the week runs
 * Monday 00:00:00.000 HKT → Sunday 19:59:59.999 HKT. Sunday 20:00 HKT is the
 * cut, so an instant at or after that cut already belongs to the NEXT week —
 * the digest goes out Sunday evening, so the sending hour is not in its own
 * window.
 *
 * AC-742-1 forbids streaks, score-lift percentages, averages and grade
 * promises. This module exposes the counted facts only; it never derives a
 * claim, an average or a projection from them.
 *
 * WhatsApp copy is pure here too: `buildDigestCopy` interpolates the labels
 * the UI already holds (both locales) into one bilingual block, so the strings
 * stay in the locale files and no copy lives in this module.
 */

import { isEligibleReviewLesson } from "@/features/cases/case-reviews";
import { completedLessonCount } from "@/features/cases/rating-window";
import {
  buildTopicCells,
  heatmapTopicKey,
  parseDrawerTopics,
  type HeatmapCell,
} from "@/features/cases/heatmap-logic";
import type { DrawerLogRow } from "@/features/cases/super-drawer/super-drawer-logic";

/** HKT is a fixed UTC+8 with no DST, so an offset is exact all year. */
export const DIGEST_TZ_OFFSET_MINUTES = 480;

/**
 * True only during Sunday 20:00 HKT — the digest's send slot.
 *
 * The Workers plan allows three cron expressions, so the digest rides the
 * hourly materials trigger instead of owning a fourth. It must therefore refuse
 * to run on the other 167 hours; this is that gate, and it is pure so the slot
 * rule is testable without waiting for a Sunday.
 */
export function isWeeklyDigestSlot(now: Date): boolean {
  const local = now.getTime() + TZ_OFFSET_MS;
  if (!Number.isFinite(local)) return false;
  const hkt = new Date(local);
  return hkt.getUTCDay() === 0 && hkt.getUTCHours() === 20;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const TZ_OFFSET_MS = DIGEST_TZ_OFFSET_MINUTES * MINUTE_MS;

/** Sunday 20:00 HKT: the cut where the next digest window opens. */
const WEEK_CUTOFF_MS = 20 * HOUR_MS;

/** Monday 00:00 → Sunday 20:00 HKT is 6 days 20 hours. */
const DIGEST_WEEK_MS = 6 * DAY_MS + WEEK_CUTOFF_MS;

/** Recaps and focus areas are summary lines, never a wall of text. */
export const DIGEST_RECAP_MAX = 3;
export const DIGEST_FOCUS_MAX = 5;
/** "Covered" is a headline list of the week's topics, not the full syllabus. */
export const DIGEST_TOPIC_MAX = 5;

/** Recaps, focus and the case code are tutor/parent-authored: never leak a
 * contact detail or an internal id into a message that leaves the app. */
const DIGEST_UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const DIGEST_EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const DIGEST_PHONE_PATTERN = /(?:\+?852[\s-]?)?\b[2-9]\d{3}[\s-]?\d{4}\b/g;

export type WeeklyDigest = {
  startIso: string;
  endIso: string;
  lessonsThisWeek: number;
  hoursThisWeek: number;
  hoursTotal: number;
  recaps: string[];
  homeworkCompleted: number;
  mistakesMastered: number;
  nextLesson: { startsAt: string; tag: string | null } | null;
  mastery: { mastered: number; practicing: number; weak: number };
  focus: string[];
  /**
   * The week's tags, newest log first — the "Covered" part of the four-part
   * recap. Optional so an older digest literal and the email section stay
   * valid; the card simply omits the part when it is absent.
   */
  topicsCovered?: string[];
};

/** `case_lessons` columns the digest reads. Structurally a LessonConfirmRow. */
export type DigestLessonRow = {
  status: string;
  confirmed_by_parent_at: string | null;
  confirmed_by_tutor_at: string | null;
  starts_at: string | null;
  duration_min: number | null;
};

/** `case_homework` columns the digest reads. */
export type DigestHomeworkRow = { submitted_at: string | null };

/** `case_mistakes` columns the digest reads. */
export type DigestMistakeRow = { status: string; mastered_at: string | null };

export type ComposeWeeklyDigestInput = {
  now: Date;
  lessons: readonly DigestLessonRow[];
  /** Drawer logs with `topics` already through `parseDrawerTopics`. */
  logs: readonly DrawerLogRow[];
  homework: readonly DigestHomeworkRow[];
  mistakes: readonly DigestMistakeRow[];
  /** Unresolved `case_mistakes` counts keyed by `heatmapTopicKey`. */
  unresolvedMistakesByTopic?: Record<string, number>;
};

function parseMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function roundHours(totalMinutes: number): number {
  const safe = Number.isFinite(totalMinutes) && totalMinutes > 0 ? totalMinutes : 0;
  return Math.round((safe / 60) * 10) / 10;
}

/**
 * Monday 00:00 HKT → Sunday 19:59:59.999 HKT of the week containing `now`.
 *
 * Worked in "HKT wall clock as UTC" so the host timezone never participates:
 * `local = now + offset`, day arithmetic on the shifted instant, then the
 * offset is removed again.
 */
export function digestWindow(now: Date): { startIso: string; endIso: string } {
  const nowMs = now.getTime();
  if (Number.isNaN(nowMs)) throw new Error("INVALID_NOW");

  const local = nowMs + TZ_OFFSET_MS;
  const localMidnight = Math.floor(local / DAY_MS) * DAY_MS;
  // 0 = Monday … 6 = Sunday. Date#getUTCDay is 0 = Sunday.
  const dayIndex = (new Date(local).getUTCDay() + 6) % 7;

  let startLocal = localMidnight - dayIndex * DAY_MS;
  // Sunday 20:00 HKT and later already belong to the next week.
  if (dayIndex === 6 && local - localMidnight >= WEEK_CUTOFF_MS) {
    startLocal += 7 * DAY_MS;
  }

  const startMs = startLocal - TZ_OFFSET_MS;
  const endMs = startMs + DIGEST_WEEK_MS - 1;
  return { startIso: new Date(startMs).toISOString(), endIso: new Date(endMs).toISOString() };
}

/** A quiet week (no lesson, homework, mistake or recap) has no digest at all. */
export function hasDigestActivity(d: {
  lessonsThisWeek: number;
  homeworkCompleted: number;
  mistakesMastered: number;
  recaps: string[];
}): boolean {
  return (
    d.lessonsThisWeek > 0 ||
    d.homeworkCompleted > 0 ||
    d.mistakesMastered > 0 ||
    d.recaps.length > 0
  );
}

/** Newest first, with the array position as the stable tie-break. */
function logsNewestFirst(logs: readonly DrawerLogRow[]): DrawerLogRow[] {
  return logs
    .map((log, index) => ({ log, index, at: parseMs(log.created_at) ?? 0 }))
    .sort((a, b) => (a.at !== b.at ? b.at - a.at : a.index - b.index))
    .map((entry) => entry.log);
}

function windowRecaps(ordered: readonly DrawerLogRow[], startMs: number, endMs: number): string[] {
  const out: string[] = [];
  for (const log of ordered) {
    if (out.length >= DIGEST_RECAP_MAX) break;
    const at = parseMs(log.created_at);
    if (at === null || at < startMs || at > endMs) continue;
    const recap = (log.recap ?? "").trim();
    if (!recap) continue;
    out.push(recap);
  }
  return out;
}

/**
 * "Covered": the tags the tutor recorded on logs created inside the window,
 * newest log first, deduped on the heatmap key so casing never duplicates a
 * topic. Capped, because this is the recap headline and not the heatmap.
 */
function windowTopics(ordered: readonly DrawerLogRow[], startMs: number, endMs: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const log of ordered) {
    const at = parseMs(log.created_at);
    if (at === null || at < startMs || at > endMs) continue;
    for (const topic of parseDrawerTopics(log.topics)) {
      if (out.length >= DIGEST_TOPIC_MAX) return out;
      const key = heatmapTopicKey(topic.tag);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(topic.tag);
    }
  }
  return out;
}

/** The next lesson's topic: the newest log's first tag, null when none exists. */
function newestTopicTag(ordered: readonly DrawerLogRow[]): string | null {
  for (const log of ordered) {
    const first = parseDrawerTopics(log.topics)[0];
    if (first) return first.tag;
  }
  return null;
}

function nextUpcomingLesson(
  lessons: readonly DigestLessonRow[],
  nowMs: number,
): { startsAt: string } | null {
  let bestMs: number | null = null;
  let bestIso: string | null = null;
  for (const lesson of lessons) {
    if (lesson.status !== "planned" && lesson.status !== "confirmed") continue;
    const ms = parseMs(lesson.starts_at);
    if (ms === null || ms <= nowMs) continue;
    if (bestMs === null || ms < bestMs) {
      bestMs = ms;
      bestIso = new Date(ms).toISOString();
    }
  }
  return bestIso === null ? null : { startsAt: bestIso };
}

/**
 * Focus = the tags the tutor marked weak first, then the tags forced weak by
 * unresolved mistakes, capped. Both bands come from `buildTopicCells`, so the
 * digest never disagrees with the heatmap about what is weak.
 */
function focusTags(cells: readonly HeatmapCell[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (cell: HeatmapCell): void => {
    const key = heatmapTopicKey(cell.tag);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(cell.tag);
  };

  for (const cell of cells) if (cell.mastery === "weak") add(cell);
  for (const cell of cells) if (cell.weakByMistakes) add(cell);
  return out.slice(0, DIGEST_FOCUS_MAX);
}

/**
 * Fold the raw rows into the digest, or null on a quiet week.
 *
 * Only facts go out: counts, rounded hours, tutor recaps, the next lesson and
 * the heatmap's mastery split. No streak, no average, no percentage, no grade
 * claim — see AC-742-1 in the module header.
 */
export function composeWeeklyDigest(input: ComposeWeeklyDigestInput): WeeklyDigest | null {
  const { startIso, endIso } = digestWindow(input.now);
  const startMs = Date.parse(startIso);
  const endMs = Date.parse(endIso);
  const nowMs = input.now.getTime();

  const verified = input.lessons.filter(isEligibleReviewLesson);
  const lessonsInWindow = verified.filter((lesson) => {
    const ms = parseMs(lesson.starts_at);
    return ms !== null && ms >= startMs && ms <= endMs;
  });

  const hoursThisWeek = roundHours(
    lessonsInWindow.reduce((sum, lesson) => sum + (Number(lesson.duration_min) || 0), 0),
  );
  const hoursTotal = roundHours(
    verified.reduce((sum, lesson) => sum + (Number(lesson.duration_min) || 0), 0),
  );

  const ordered = logsNewestFirst(input.logs);
  const recaps = windowRecaps(ordered, startMs, endMs);

  const homeworkCompleted = input.homework.filter((row) => {
    const ms = parseMs(row.submitted_at);
    return ms !== null && ms >= startMs && ms <= endMs;
  }).length;

  const mistakesMastered = input.mistakes.filter((row) => {
    if (row.status !== "mastered") return false;
    const ms = parseMs(row.mastered_at);
    return ms !== null && ms >= startMs && ms <= endMs;
  }).length;

  const lessonsThisWeek = completedLessonCount(lessonsInWindow);

  if (!hasDigestActivity({ lessonsThisWeek, homeworkCompleted, mistakesMastered, recaps })) {
    return null;
  }

  const { cells, summary } = buildTopicCells(ordered, input.unresolvedMistakesByTopic ?? {});
  const next = nextUpcomingLesson(input.lessons, nowMs);

  return {
    startIso,
    endIso,
    lessonsThisWeek,
    hoursThisWeek,
    hoursTotal,
    recaps,
    homeworkCompleted,
    mistakesMastered,
    nextLesson: next ? { startsAt: next.startsAt, tag: newestTopicTag(ordered) } : null,
    mastery: {
      mastered: summary.mastered,
      practicing: summary.practicing,
      weak: summary.weak,
    },
    focus: focusTags(cells),
    topicsCovered: windowTopics(ordered, startMs, endMs),
  };
}

// ---------------------------------------------------------------------------
// WhatsApp copy (pure): the UI passes the locale strings, this only formats.
// ---------------------------------------------------------------------------

export type DigestLabels = Record<
  | "header"
  | "case"
  | "lessons"
  | "hoursWeek"
  | "hoursTotal"
  | "recap"
  | "homework"
  | "mistakes"
  | "next"
  | "mastery"
  | "focus",
  string
>;

/** Line between the English block and the Chinese one; no letters, so it
 * reads as a divider in either language. */
const DIGEST_COPY_SEPARATOR = "· · ·";

const DIGEST_BULLET = "• ";

/** Strip ids and contact details from free text before it leaves the app. */
function sanitizeDigestText(value: string): string {
  return value
    .replace(DIGEST_UUID_PATTERN, " ")
    .replace(DIGEST_EMAIL_PATTERN, " ")
    .replace(DIGEST_PHONE_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** `{{name}}` mustache, the locale files' existing placeholder syntax. */
function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? (vars[key] ?? "") : match,
  );
}

function formatHours(hours: number): string {
  const value = Number.isFinite(hours) ? hours : 0;
  return String(value);
}

/** One locale's lines for a digest. Exported for the email half (#796 §2.6). */
export function digestLines(input: {
  digest: WeeklyDigest;
  zone: "en" | "zh";
  labels: DigestLabels;
  caseCode: string;
  formatWhen: (iso: string, zone: "en" | "zh") => string;
  /**
   * The email renders its own "Case <code>" heading per section, so it opts out
   * of the WhatsApp block's header + case preamble. Default true keeps the
   * copy-to-clipboard block unchanged.
   */
  includePreamble?: boolean;
}): string[] {
  const { digest, zone, labels } = input;
  const lines: string[] = [];
  const push = (line: string): void => {
    const trimmed = line.trim();
    if (trimmed) lines.push(trimmed);
  };

  if (input.includePreamble !== false) {
    push(labels.header);
    push(fill(labels.case, { code: sanitizeDigestText(input.caseCode) }));
  }
  push(fill(labels.lessons, { n: String(digest.lessonsThisWeek) }));
  push(fill(labels.hoursWeek, { h: formatHours(digest.hoursThisWeek) }));
  push(fill(labels.hoursTotal, { h: formatHours(digest.hoursTotal) }));

  if (digest.recaps.length > 0) {
    push(labels.recap);
    for (const recap of digest.recaps) push(`${DIGEST_BULLET}${sanitizeDigestText(recap)}`);
  }

  push(fill(labels.homework, { n: String(digest.homeworkCompleted) }));
  push(fill(labels.mistakes, { n: String(digest.mistakesMastered) }));

  if (digest.nextLesson) {
    const when = input.formatWhen(digest.nextLesson.startsAt, zone);
    const base = fill(labels.next, { when });
    const tag = digest.nextLesson.tag ? sanitizeDigestText(digest.nextLesson.tag) : "";
    push(tag ? `${base} · ${tag}` : base);
  }

  push(
    fill(labels.mastery, {
      mastered: String(digest.mastery.mastered),
      practicing: String(digest.mastery.practicing),
      weak: String(digest.mastery.weak),
    }),
  );

  if (digest.focus.length > 0) {
    push(labels.focus);
    for (const tag of digest.focus) push(`${DIGEST_BULLET}${sanitizeDigestText(tag)}`);
  }

  return lines;
}

/**
 * One paste-ready WhatsApp message: the English block, a divider, the Chinese
 * block, then the link. Labels arrive already translated from the locale
 * files, so no copy is authored here; `formatWhen` owns the date rendering per
 * language. Free text is scrubbed of ids, emails and phone numbers.
 */
export function buildDigestCopy(input: {
  digest: WeeklyDigest;
  caseCode: string;
  link: string;
  en: DigestLabels;
  zh: DigestLabels;
  formatWhen: (iso: string, zone: "en" | "zh") => string;
}): string {
  const en = digestLines({
    digest: input.digest,
    zone: "en",
    labels: input.en,
    caseCode: input.caseCode,
    formatWhen: input.formatWhen,
  });
  const zh = digestLines({
    digest: input.digest,
    zone: "zh",
    labels: input.zh,
    caseCode: input.caseCode,
    formatWhen: input.formatWhen,
  });
  return [...en, DIGEST_COPY_SEPARATOR, ...zh, input.link.trim()].join("\n");
}
