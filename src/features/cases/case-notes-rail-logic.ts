/**
 * Issue #796 §2.3 (was #744) — deterministic, zero-click notes recommendation
 * rail, pure half (vitest-covered).
 *
 * Signals come from the #767 Super-Drawer `#tag`s in `case_lesson_logs.topics`
 * (newest first) and, only as a secondary fallback, the #796 §2.2 Mistake Book's
 * `topic_tag`s. The rail is a learner-side surface: it never invents a subject
 * match for a peer tutor, and `null` means "render nothing".
 *
 * No DB access here — case-notes-rail.functions.ts reads rows, maps them into
 * RailNote and lets this module decide order and inclusion.
 */

import { matchesSubjectQuery } from "@/features/tutors/subjects";
import type {
  DrawerLogRow,
  DrawerTopic,
  MasteryLevel,
} from "@/features/cases/super-drawer/super-drawer-logic";

export type RailNote = {
  id: string;
  slug: string | null;
  title: string;
  priceHkd: number;
  coverPath: string | null;
  materialType: string;
  tutorId: string;
  tutorDisplayName: string;
  tutorCode: string;
  tutorVerified: boolean;
  subjectTag: string | null;
  topic: string | null;
  searchTags: string[];
  createdAt: string;
};

export type RailItem = RailNote & { byYourTutor: boolean };

/** The rail shows at most three cards (zero extra clicks to see the rest). */
const DEFAULT_RAIL_LIMIT = 3;

type RankedTag = { key: string; rank: number };

/**
 * weak → practicing → null → mastered. The ticket's "prefer Weak / Practicing
 * over Mastered" rule falls out of this rank once tags are read across logs.
 */
function masteryRank(mastery: MasteryLevel | null): number {
  if (mastery === "weak") return 0;
  if (mastery === "practicing") return 1;
  if (mastery === null) return 2;
  return 3;
}

function tagKey(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** One log's tags in mastery-priority order, deduped case-insensitively. */
function rankedTags(topics: readonly DrawerTopic[]): RankedTag[] {
  const seen = new Set<string>();
  const out: RankedTag[] = [];
  const ranked = topics
    .map((topic, order) => ({ key: tagKey(topic.tag), rank: masteryRank(topic.mastery), order }))
    .filter((topic) => topic.key !== "")
    .sort((a, b) => a.rank - b.rank || a.order - b.order);
  for (const topic of ranked) {
    if (seen.has(topic.key)) continue;
    seen.add(topic.key);
    out.push({ key: topic.key, rank: topic.rank });
  }
  return out;
}

/**
 * Signal tags in priority order.
 *
 *  1. the newest log that carries topics: its weak / practicing tags, then the
 *     most recent weak / practicing tags from earlier logs (so a later fully
 *     mastered lesson never buries an earlier weak one),
 *  2. then that newest log's null / mastered tags,
 *  3. no topics on any log → the Mistake Book tags, in their own newest order.
 */
function signalTags(logs: readonly DrawerLogRow[], mistakeTopicTags: readonly string[]): string[] {
  const withTopics = logs
    .map((log) => (log.topics ?? []).filter((topic) => tagKey(topic.tag) !== ""))
    .filter((topics) => topics.length > 0);

  const out: string[] = [];
  const seen = new Set<string>();
  const push = (key: string) => {
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(key);
  };

  if (withTopics.length === 0) {
    for (const raw of mistakeTopicTags) push(tagKey(raw));
    return out;
  }

  const [newest, ...earlier] = withTopics;
  const newestTags = rankedTags(newest);
  for (const tag of newestTags) if (tag.rank <= 1) push(tag.key);
  for (const topics of earlier) {
    for (const tag of rankedTags(topics)) if (tag.rank <= 1) push(tag.key);
  }
  for (const tag of newestTags) if (tag.rank >= 2) push(tag.key);
  return out;
}

/** Lowest signal index this note matches, or null when it matches none. */
function matchIndex(note: RailNote, signalIndex: Map<string, number>): number | null {
  let best: number | null = null;
  const consider = (value: string | null | undefined) => {
    const index = signalIndex.get(tagKey(value));
    if (index === undefined) return;
    if (best === null || index < best) best = index;
  };
  consider(note.topic);
  consider(note.subjectTag);
  for (const tag of note.searchTags) consider(tag);
  return best;
}

function instantOf(value: string): number {
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

/** Tag priority first, then newest note. */
function compareMatches(
  a: { index: number; note: RailNote },
  b: { index: number; note: RailNote },
): number {
  if (a.index !== b.index) return a.index - b.index;
  return instantOf(b.note.createdAt) - instantOf(a.note.createdAt);
}

/** Case/whitespace-insensitive subject equivalence (mirrors note-tutor-upsell). */
function sameSubject(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (!x || !y) return false;
  return matchesSubjectQuery(x, y) || matchesSubjectQuery(y, x);
}

/**
 * Rank published notes against the case's current #tags.
 *
 * Tier order: own tutor exact matches, then peer exact matches, then (only when
 * nothing matched) the own tutor's same-subject notes. Peer subject-level notes
 * are never a fallback. `null` = render nothing.
 */
export function buildNotesRail(input: {
  logs: readonly DrawerLogRow[];
  mistakeTopicTags: readonly string[];
  caseTutorId: string | null;
  caseSubject: string | null;
  notes: readonly RailNote[];
  limit?: number;
}): RailItem[] | null {
  const requested = input.limit ?? DEFAULT_RAIL_LIMIT;
  const limit = Number.isFinite(requested)
    ? Math.max(0, Math.floor(requested))
    : DEFAULT_RAIL_LIMIT;
  if (limit === 0) return null;

  const signal = signalTags(input.logs, input.mistakeTopicTags);
  const signalIndex = new Map<string, number>();
  signal.forEach((key, index) => signalIndex.set(key, index));

  const ownTutorId = input.caseTutorId;
  const ownMatches: { index: number; note: RailNote }[] = [];
  const peerMatches: { index: number; note: RailNote }[] = [];

  if (signal.length > 0) {
    for (const note of input.notes) {
      const index = matchIndex(note, signalIndex);
      if (index === null) continue;
      if (ownTutorId !== null && note.tutorId === ownTutorId) {
        ownMatches.push({ index, note });
      } else {
        peerMatches.push({ index, note });
      }
    }
  }

  ownMatches.sort(compareMatches);
  peerMatches.sort(compareMatches);

  const picked: RailItem[] = [];
  const seen = new Set<string>();
  const push = (note: RailNote, byYourTutor: boolean) => {
    if (picked.length >= limit || seen.has(note.id)) return;
    seen.add(note.id);
    picked.push({ ...note, byYourTutor });
  };
  for (const match of ownMatches) push(match.note, true);
  for (const match of peerMatches) push(match.note, false);
  if (picked.length > 0) return picked;

  // Cold start: zero exact matches. Only the case tutor's own subject-level
  // notes qualify — never a peer's.
  const subject = (input.caseSubject ?? "").trim();
  if (!ownTutorId || !subject) return null;

  const ownSubject = input.notes
    .filter(
      (note) =>
        note.tutorId === ownTutorId &&
        typeof note.subjectTag === "string" &&
        sameSubject(note.subjectTag, subject),
    )
    .sort((a, b) => instantOf(b.createdAt) - instantOf(a.createdAt))
    .slice(0, limit)
    .map((note) => ({ ...note, byYourTutor: true }));

  return ownSubject.length > 0 ? ownSubject : null;
}
