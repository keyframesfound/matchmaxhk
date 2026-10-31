/**
 * Issue #445 + #448 — internal tutor desk track (Master Sheet Tutors W–Y,
 * in-app). Shared types + labels + the Tutor Service Guide link for the
 * staff surfaces (tutor admin editor, matchmaking shortlist).
 *
 * Storage is the service-role-only `tutor_desk_track` table (#441 risk_flags
 * posture): never public, never on parent/tutor surfaces. match_tutors_for_case
 * reads it for the #448 soft sort and never returns it.
 *
 * Desk rules (CS-005, CEO lock 2026-10-24):
 *   * Level is manual in V1. Upgrade New → Active after 1 paid fee-collected
 *     case OR 5+ verified Pro-Bono hours; Experienced stays manual.
 *   * Soft prefer only — agents override freely when supply is thin.
 *   * At 2+ early L1 drop-offs, set the #441 REVIEW flag (button below).
 */

export const TUTOR_SERVICE_GUIDE_URL =
  "https://docs.google.com/document/d/1bud1zUJMLE2HU-la23dlN9xalzJZK6P4TnZZic61q58/edit";

export type DeskTutorLevel = "new" | "active" | "experienced";

export const DESK_LEVELS: readonly DeskTutorLevel[] = ["new", "active", "experienced"];

export function normalizeDeskLevel(raw: unknown): DeskTutorLevel {
  return typeof raw === "string" && (DESK_LEVELS as readonly string[]).includes(raw)
    ? (raw as DeskTutorLevel)
    : "new";
}

export const DESK_LEVEL_LABELS: Record<DeskTutorLevel, string> = {
  new: "New",
  active: "Active",
  experienced: "Experienced",
};

/** CS-005 desk hint shown beside the level select. */
export const DESK_LEVEL_HINTS: Record<DeskTutorLevel, string> = {
  new: "Prefer foundation, junior secondary, short-case and Pro-Bono desks; avoid S6/DSE final and IBDP Y2 unless supply is thin.",
  active: "1 paid fee-collected case or 5+ verified Pro-Bono hours.",
  experienced: "Manual in V1 — set from the Master Sheet judgement call.",
};

/** #448: 2+ early L1 drop-offs point at the #441 REVIEW path. */
export const L1_DROPOFF_REVIEW_THRESHOLD = 2;

export const DROPOFF_NOTE_MAX = 500;

/** One desk-track row as the UI consumes it (staff-only surface). */
export type DeskTrackRow = {
  tutor_id: string;
  tutor_level: DeskTutorLevel;
  guide_sent_at: string | null;
  guide_sent_by: string | null;
  l1_early_dropoffs: number;
  dropoff_note: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

export function toDeskTrackRow(row: Record<string, unknown>): DeskTrackRow {
  return {
    tutor_id: String(row.tutor_id),
    tutor_level: normalizeDeskLevel(row.tutor_level),
    guide_sent_at: (row.guide_sent_at as string | null) ?? null,
    guide_sent_by: (row.guide_sent_by as string | null) ?? null,
    l1_early_dropoffs: Number(row.l1_early_dropoffs ?? 0),
    dropoff_note: (row.dropoff_note as string | null) ?? null,
    updated_at: (row.updated_at as string | null) ?? null,
    updated_by: (row.updated_by as string | null) ?? null,
  };
}
