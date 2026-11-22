/**
 * Issue #796 §2.4 (was #733) — private lesson usefulness pulse, pure rules.
 *
 * After a VERIFIED (completed) lesson the parent or the student owner gets one
 * private one-tap pulse: very useful / okay / needs adjustment, plus up to two
 * preset tags. It never touches `case_reviews`, never publishes, and a tutor
 * never sees the rows or any aggregate over them — only Ops does.
 *
 * Gating is literal AC-733-2: the prompt appears at completed-lesson counts
 * 5, 10, 15, … and must NOT appear at 6. An unanswered milestone is not carried
 * forward to an off-cadence lesson.
 *
 * No DB access here; the server fns and the card share these decisions.
 */

/** First milestone: after five verified lessons. */
export const PULSE_MILESTONE_FIRST = 5;
/** Every fifth verified lesson thereafter. */
export const PULSE_MILESTONE_STEP = 5;

/**
 * The milestone due at this completed-lesson count, or null.
 *
 * The milestone IS the count: 5 → 5, 6 → null, 10 → 10. 4 and below → null.
 */
export function duePulseMilestone(completedLessonCount: number): number | null {
  if (!Number.isInteger(completedLessonCount)) return null;
  if (completedLessonCount < PULSE_MILESTONE_FIRST) return null;
  if (completedLessonCount % PULSE_MILESTONE_STEP !== 0) return null;
  return completedLessonCount;
}

export const PULSE_VERDICTS = ["very_useful", "okay", "needs_adjustment"] as const;

export type PulseVerdict = (typeof PULSE_VERDICTS)[number];

/** Canonical tag order — also the order the server returns and the UI renders. */
export const PULSE_TAGS = [
  "clear_concepts",
  "good_pace",
  "pace_too_fast",
  "more_past_papers",
] as const;

export type PulseTag = (typeof PULSE_TAGS)[number];

/** The ticket allows 1–2 preset tags on a pulse. */
export const PULSE_TAG_MAX = 2;

/**
 * Keep only recognised tags, drop duplicates and garbage, return them in
 * canonical order, capped at PULSE_TAG_MAX.
 */
export function sanitizePulseTags(input: unknown): PulseTag[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<PulseTag>();
  for (const value of input) {
    if (typeof value !== "string") continue;
    if (!(PULSE_TAGS as readonly string[]).includes(value)) continue;
    seen.add(value as PulseTag);
  }
  const ordered: PulseTag[] = [];
  for (const tag of PULSE_TAGS) {
    if (seen.has(tag)) ordered.push(tag);
  }
  return ordered.slice(0, PULSE_TAG_MAX);
}

/** "Needs adjustment" is the only verdict that flags the row for the Ops desk. */
export function flagsOpsForVerdict(v: PulseVerdict): boolean {
  return v === "needs_adjustment";
}

/** Type guard for a verdict string coming back from the database. */
export function isPulseVerdict(value: unknown): value is PulseVerdict {
  return typeof value === "string" && (PULSE_VERDICTS as readonly string[]).includes(value);
}
