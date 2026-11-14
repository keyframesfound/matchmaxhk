/**
 * Issue #767 Super-Drawer (was #746, packs #743) — pure half.
 *
 * The 60-second sole tutor post-lesson write surface. All rules that the
 * server fns and the drawer UI share live here (vitest-covered): smart
 * defaults, the Wave-1 minimum (1 #tag + 1 pulse), recap_status, the
 * silent fan-out contract and context-aware topic chip ordering. The
 * server fns (super-drawer.functions.ts) only orchestrate reads/writes.
 *
 * Fee SoT stays #760: this module never computes amounts; the drawer's
 * verified-lesson write calls syncCaseFeeMilestones(..., "case_lesson")
 * which reuses the existing engines.
 */

/** Mastery vocabulary — same enum the #740 Heatmap uses (CEO lock). */
export const MASTERY_LEVELS = ["weak", "practicing", "mastered"] as const;
export type MasteryLevel = (typeof MASTERY_LEVELS)[number];

export type DrawerTopic = { tag: string; mastery: MasteryLevel | null };

/** Three-row pulse (Wave 1 ships all three; never one composite control). */
export const PUNCTUALITY_VALUES = ["on_time", "late"] as const;
export const FOCUS_VALUES = ["attentive", "good", "distracted"] as const;
export const PREP_VALUES = ["prepared", "partial", "none"] as const;
export type PulsePunctuality = (typeof PUNCTUALITY_VALUES)[number];
export type PulseFocus = (typeof FOCUS_VALUES)[number];
export type PulsePrep = (typeof PREP_VALUES)[number];

export type DrawerPulse = {
  punctuality: PulsePunctuality;
  focus: PulseFocus;
  prepHw: PulsePrep;
};

/** Aggressive default #1: the positive states are pre-selected. */
export const DEFAULT_PULSE: DrawerPulse = {
  punctuality: "on_time",
  focus: "attentive",
  prepHw: "prepared",
};

/** Stored jsonb shape for pulse (snake_case columns live in the DB). */
export type StoredPulse = {
  punctuality?: string;
  focus?: string;
  prep_hw?: string;
};

/** case_lesson_logs row shape (table not in generated types — structural). */
export type DrawerLogRow = {
  id: string;
  case_id: string;
  lesson_id: string;
  logged_by: string;
  recap_status: "incomplete" | "complete";
  topics: DrawerTopic[];
  pulse: StoredPulse;
  recap: string | null;
  next_lesson_at: string | null;
  created_at: string;
  updated_at: string;
};

/** case_lesson_fanouts row shape (table not in generated types — structural). */
export type DrawerFanoutRow = {
  id: string;
  case_id: string;
  lesson_id: string;
  job: FanoutJob;
  status: "pending" | "processed" | "failed";
  created_at: string;
};

export type FanoutJob = "heatmap_cell" | "notes_recommendations" | "weekly_digest";

export const FANOUT_JOBS: readonly FanoutJob[] = [
  "heatmap_cell",
  "notes_recommendations",
  "weekly_digest",
];

// ---------------------------------------------------------------------------
// Duration (Section 1 — Required for BOTH Sync and Log Hours Only)
// ---------------------------------------------------------------------------

/** DB check: case_lessons.duration_min BETWEEN 15 AND 480. Drawer steps 0.5h. */
export const DRAWER_DURATION_MIN = 30;
export const DRAWER_DURATION_MAX = 480;
export const DRAWER_DURATION_STEP = 30;

/**
 * Smart default #2: duration = the case's standard weekly length
 * (tutoring_cases.session_length_minutes), clamped to the drawer range;
 * 60 min fallback when the case never declared one.
 */
export function defaultDurationMin(sessionLengthMinutes: number | null | undefined): number {
  const n = Number(sessionLengthMinutes);
  if (!Number.isFinite(n) || n <= 0) return 60;
  return clampDurationMin(n);
}

export function clampDurationMin(min: number): number {
  if (!Number.isFinite(min)) return 60;
  return Math.min(DRAWER_DURATION_MAX, Math.max(DRAWER_DURATION_MIN, Math.round(min / 30) * 30));
}

export function stepDurationMin(min: number, direction: -1 | 1): number {
  return clampDurationMin(min + direction * DRAWER_DURATION_STEP);
}

// ---------------------------------------------------------------------------
// Next lesson (Section 4 — smart default #3: +7 days, same time)
// ---------------------------------------------------------------------------

export function nextLessonDefaultIso(now: Date = new Date()): string {
  return new Date(now.getTime() + 7 * 86_400_000).toISOString();
}

// ---------------------------------------------------------------------------
// Wave-1 minimum + recap status
// ---------------------------------------------------------------------------

export type DrawerMode = "full" | "hours_only";

/**
 * Wave 1 minimum: Full Sync carries >=1 syllabus #tag (the 15-second path:
 * defaults + 1 tag + pulse confirm + Sync). Log Hours Only skips everything
 * and lands 'incomplete' (the [ Add Recap & Tags ] badge).
 */
export function recapStatusFor(mode: DrawerMode, topicCount: number): "incomplete" | "complete" {
  if (mode === "hours_only") return "incomplete";
  return topicCount >= 1 ? "complete" : "incomplete";
}

/**
 * The one validation the Sync path enforces server-side: full sync needs
 * >=1 tag. Returns an error code the UI maps to copy; null = ok.
 */
export function syncValidationError(mode: DrawerMode, topicCount: number): string | null {
  if (mode === "full" && topicCount < 1) return "TAG_REQUIRED";
  return null;
}

// ---------------------------------------------------------------------------
// Silent fan-out contract (zero extra tutor clicks; consumers are #740/#744
// later work — this ticket only enqueues table rows)
// ---------------------------------------------------------------------------

/**
 * Full Sync with >=1 tag: heatmap cell + notes recommendations (+ the digest
 * signal). Hours-Only: digest signal only — the heatmap stays empty until
 * tags are completed later (known Fracture 2; keep the hatch).
 */
export function fanoutJobsFor(mode: DrawerMode, topicCount: number): FanoutJob[] {
  if (mode === "full" && topicCount >= 1) {
    return ["heatmap_cell", "notes_recommendations", "weekly_digest"];
  }
  return ["weekly_digest"];
}

// ---------------------------------------------------------------------------
// Context-aware topic chips (smart default #4)
// ---------------------------------------------------------------------------

export type PriorTopic = { tag: string; mastery: MasteryLevel | null };

/**
 * Suggest 2-4 chips, prioritised: currently-Weak topics (mastery 'weak' from
 * prior logs on this case), then Practicing, then the most recent other
 * topics, then the case subject as a subject-default chip. Deduped
 * case-insensitively; free-text Add remains available.
 */
export function suggestedTopics(
  priorTopics: readonly PriorTopic[],
  subject: string | null | undefined,
  max = 4,
): DrawerTopic[] {
  const seen = new Set<string>();
  const out: DrawerTopic[] = [];
  const push = (tag: string, mastery: MasteryLevel | null) => {
    const clean = tag.trim().replace(/^#/, "").trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ tag: clean, mastery });
  };
  const byMastery = (m: MasteryLevel) => priorTopics.filter((p) => p.mastery === m);
  // Most-recent-first within each band keeps "prior next lesson topic" near
  // the top (callers pass prior topics newest-first).
  for (const p of byMastery("weak").slice(0, 2)) push(p.tag, "weak");
  for (const p of byMastery("practicing").slice(0, 1)) push(p.tag, "practicing");
  for (const p of priorTopics) {
    if (out.length >= max) break;
    push(p.tag, p.mastery);
  }
  if (out.length < max && subject) push(subject, null);
  return out.slice(0, max);
}

/** Strip display chrome and length-cap a free-text topic. */
export function normalizeTopicTag(raw: string): string | null {
  const clean = raw.trim().replace(/^#/, "").trim();
  if (!clean || clean.length > 60) return null;
  return clean;
}
