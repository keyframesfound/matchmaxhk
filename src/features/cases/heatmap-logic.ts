/**
 * Issue #796 §2.1 — Syllabus Topic Mastery Heatmap, pure half.
 *
 * The heatmap has no storage of its own: every cell is derived from the #767
 * Super-Drawer logs (`case_lesson_logs.topics`) plus the #796 §2.2 mistake book
 * (`case_mistakes.topic_tag`, unresolved rows only). All rules the server fn
 * and the drawer share live here so vitest can pin them without a database.
 *
 * Mastery vocabulary is the #767 enum (`MASTERY_LEVELS`) — never a second one.
 */

import {
  MASTERY_LEVELS,
  type DrawerLogRow,
  type DrawerTopic,
  type MasteryLevel,
} from "@/features/cases/super-drawer/super-drawer-logic";

/** Unresolved mistakes on a topic that force it to "weak" without a tutor tag. */
export const WEAK_MISTAKE_THRESHOLD = 3;

export type HeatmapCell = {
  tag: string;
  mastery: MasteryLevel | null;
  /** How many drawer logs tagged this topic (one sighting per log max). */
  sightings: number;
  /** >= WEAK_MISTAKE_THRESHOLD unresolved mistakes on this topic. */
  weakByMistakes: boolean;
};

export type HeatmapSummary = {
  mastered: number;
  practicing: number;
  weak: number;
  masteredPct: number;
};

export type Heatmap = {
  cells: HeatmapCell[];
  summary: HeatmapSummary;
};

const MASTERY_SET = new Set<string>(MASTERY_LEVELS);

/**
 * Display/compare normalisation: strip the UI's `#` chrome, trim, cap. Returns
 * null for anything unusable so callers never invent an empty cell.
 * Mirrors `normalizeTopicTag` in the drawer logic (kept local so this module
 * never pulls UI-facing helpers into a server import path).
 */
export function normalizeHeatmapTag(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw.trim().replace(/^#/, "").trim();
  if (!clean || clean.length > 80) return null;
  return clean;
}

/** Case-insensitive identity of a topic; display casing lives on the cell. */
export function heatmapTopicKey(raw: unknown): string {
  return (normalizeHeatmapTag(raw) ?? "").toLowerCase();
}

/**
 * jsonb -> topics. Tolerates older/partial rows: non-objects, missing tags and
 * unknown mastery strings are dropped rather than rendered as blank cells.
 */
export function parseDrawerTopics(value: unknown): DrawerTopic[] {
  if (!Array.isArray(value)) return [];
  const out: DrawerTopic[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const tag = normalizeHeatmapTag(record.tag);
    if (!tag) continue;
    const mastery =
      typeof record.mastery === "string" && MASTERY_SET.has(record.mastery)
        ? (record.mastery as MasteryLevel)
        : null;
    out.push({ tag, mastery });
  }
  return out;
}

/** Counts keyed by any casing -> a normalised lookup used by buildTopicCells. */
function mistakeCountsByTopic(
  unresolvedMistakesByTopic: Record<string, number>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const [tag, rawCount] of Object.entries(unresolvedMistakesByTopic ?? {})) {
    const key = heatmapTopicKey(tag);
    if (!key) continue;
    const count = Number(rawCount);
    if (!Number.isFinite(count) || count <= 0) continue;
    counts.set(key, (counts.get(key) ?? 0) + count);
  }
  return counts;
}

/** Weak beats practicing beats mastered beats never-tagged. */
function bandOf(cell: HeatmapCell): 0 | 1 | 2 | 3 {
  if (cell.mastery === "weak" || cell.weakByMistakes) return 0;
  if (cell.mastery === "practicing") return 1;
  if (cell.mastery === "mastered") return 2;
  return 3;
}

function compareCells(a: HeatmapCell, b: HeatmapCell): number {
  const band = bandOf(a) - bandOf(b);
  if (band !== 0) return band;
  if (a.sightings !== b.sightings) return b.sightings - a.sightings;
  const folded = a.tag.localeCompare(b.tag, "en", { sensitivity: "base" });
  return folded !== 0 ? folded : a.tag.localeCompare(b.tag);
}

type Accumulator = {
  tag: string;
  mastery: MasteryLevel | null;
  sightings: number;
};

/**
 * Fold every drawer log into one cell per topic.
 *
 * Ordering rules:
 *  - newest log wins for mastery; a later `mastery: null` never erases an
 *    earlier level (the last non-null value sticks);
 *  - the display tag is the newest casing seen;
 *  - `sightings` counts logs, not entries (one tag twice in one log = 1).
 */
export function buildTopicCells(
  logs: readonly DrawerLogRow[],
  unresolvedMistakesByTopic: Record<string, number>,
): Heatmap {
  // Oldest first so each later log overwrites the earlier state.
  const ordered = logs
    .map((log, index) => ({ log, index, at: Date.parse(log.created_at) }))
    .sort((a, b) => {
      const aAt = Number.isNaN(a.at) ? 0 : a.at;
      const bAt = Number.isNaN(b.at) ? 0 : b.at;
      return aAt !== bAt ? aAt - bAt : a.index - b.index;
    });

  const cells = new Map<string, Accumulator>();
  for (const { log } of ordered) {
    const seenInLog = new Set<string>();
    for (const topic of parseDrawerTopics(log.topics)) {
      const key = heatmapTopicKey(topic.tag);
      if (!key) continue;
      const cell = cells.get(key) ?? { tag: topic.tag, mastery: null, sightings: 0 };
      // Newest casing is the display tag.
      cell.tag = topic.tag;
      // Last non-null mastery sticks: a null never erases a level.
      if (topic.mastery) cell.mastery = topic.mastery;
      if (!seenInLog.has(key)) {
        cell.sightings += 1;
        seenInLog.add(key);
      }
      cells.set(key, cell);
    }
  }

  const mistakeCounts = mistakeCountsByTopic(unresolvedMistakesByTopic);
  const out: HeatmapCell[] = [...cells.entries()].map(([key, cell]) => ({
    tag: cell.tag,
    mastery: cell.mastery,
    sightings: cell.sightings,
    weakByMistakes: (mistakeCounts.get(key) ?? 0) >= WEAK_MISTAKE_THRESHOLD,
  }));
  out.sort(compareCells);

  const summary: HeatmapSummary = {
    mastered: 0,
    practicing: 0,
    weak: 0,
    masteredPct: 0,
  };
  for (const cell of out) {
    const band = bandOf(cell);
    if (band === 0) summary.weak += 1;
    else if (band === 1) summary.practicing += 1;
    else if (band === 2) summary.mastered += 1;
  }
  summary.masteredPct = out.length === 0 ? 0 : Math.round((summary.mastered / out.length) * 100);

  return { cells: out, summary };
}
