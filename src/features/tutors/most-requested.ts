// Issue #768 Part 2 §3.C/§5: deterministic 50/50 blend behind the home
// "Most Requested Tutors This Week" rail. The old rail was a pure 30-day
// popularity ranking, which starved brand-new but fully-finished profiles and
// kept the same faces up for weeks. The replacement is deliberately boring:
//
//   velocity half   — trailing-14-day requests/saves among tutors who still
//                     have open availability (demand we can actually serve)
//   completeness half — profile-complete tutors with ZERO active cases
//                     (a finished profile with room for a new student)
//
// Rotation is the existing HKT calendar-day hash (daily-shuffle.ts), never a
// per-reload shuffle, so the rail is byte-identical for every visitor on a
// given Hong Kong day and flips at HKT midnight. No ML re-rank, no
// personalisation (#627 stays parked).
import { countAvailableCells, parseAvailabilityGrid } from "./availability-grid-model";
import { isHourlyEmpty, parseHourlyGrid, projectLegacyGrid } from "./availability-hours-model";
import { dailyTieKey } from "./daily-shuffle";
import type { RankedTrending } from "./engagement";
import type { TutorPublicStats } from "./most-requested-stats";
import { getTutorCardHighlights, type Tutor } from "./queries";

/** Requests are a stronger intent signal than a save. */
const REQUESTS_14D_WEIGHT = 3;
const SAVES_14D_WEIGHT = 1;

export type MostRequestedInput = {
  /** Published tutors, the rail's candidate rows. */
  tutors: readonly Tutor[];
  /** Rows from get_tutor_public_stats; empty = the RPC is unavailable. */
  stats: readonly TutorPublicStats[];
  /** How many cards the rail renders (TRENDING_TUTOR_LIMIT). */
  railLength: number;
  /** Asia/Hong_Kong calendar date ("YYYY-MM-DD"), see hktDate(). */
  day: string;
};

/**
 * A card is "complete" only when the fields it actually renders are filled.
 * Mirrors the admin completeness filter
 * (src/routes/_authenticated.admin.tutors.tsx) so staff and the rail agree on
 * what a finished profile means: photo, at least one subject, at least one
 * card highlight and a real hourly rate.
 */
function isProfileComplete(tutor: Tutor): boolean {
  return (
    Boolean(tutor.photo_url) &&
    Array.isArray(tutor.subjects) &&
    tutor.subjects.length > 0 &&
    getTutorCardHighlights(tutor).length > 0 &&
    tutor.hourly_rate > 0
  );
}

/**
 * Issue #768: the hourly grid is the availability source of truth, so a tutor
 * counts as available when
 *   - `availability_hours` has at least one open hour, OR
 *   - the legacy 3-state grid still projects to at least one open hour, OR
 *   - the row has no hourly hours at all and the legacy grid carries any
 *     non-"u" cell (pre-#768 behaviour, which also counts "p" / partial).
 * Rows whose only signal is the hourly column therefore stay eligible instead
 * of silently dropping off the rail.
 */
function hasOpenAvailability(tutor: Tutor): boolean {
  // tutors.availability_hours is not in the generated Database types yet
  // (#768 Part 1 owns that file), so the column is read defensively here.
  const rawHours = (tutor as { availability_hours?: unknown }).availability_hours;
  const hourly = parseHourlyGrid(rawHours);
  if (!isHourlyEmpty(hourly)) return true;
  if (!isHourlyEmpty(projectLegacyGrid(tutor.availability_grid))) return true;
  // Known-empty hourly hours by now: preserve the legacy semantics for
  // un-migrated rows, where "a" and "p" both mean the tutor still has room.
  return countAvailableCells(parseAvailabilityGrid(tutor.availability_grid)) > 0;
}

/**
 * The tutor ids the rail needs stats for: every published tutor plus every
 * trending candidate (a candidate may not be in the published page cache).
 * Sorted so the same data always produces the same React Query key.
 */
export function mostRequestedCandidateIds(
  tutors: readonly Tutor[],
  candidates: readonly { tutor_id: string }[],
): string[] {
  const ids = new Set<string>();
  for (const tutor of tutors) ids.add(tutor.id);
  for (const candidate of candidates) ids.add(candidate.tutor_id);
  return [...ids].sort();
}

/**
 * Zeroed engagement for a completeness-half tutor that never appeared in the
 * trending candidate set. Every badge threshold in engagement.ts sits above
 * zero, so these entries render the card with no demand badge — never a
 * fabricated "popular" claim.
 */
export function emptyRankedEngagement(tutorId: string): RankedTrending {
  return {
    tutor_id: tutorId,
    inquiries_7d: 0,
    views_30d: 0,
    requests_30d: 0,
    saves_total: 0,
    saves_30d: 0,
    base_score: 0,
    popularity_score: 0,
  };
}

/**
 * Blended rail order, velocity half first. The odd card out goes to the
 * velocity half (`Math.ceil`), because demand is the signal parents act on.
 *
 * Returns `null` when there is nothing trustworthy to blend — no stats rows at
 * all (RPC missing or failed) or no tutor clearing either pool. Callers keep
 * the pre-#768 ranking in that case, so a broken RPC degrades to today's page
 * instead of an empty rail.
 *
 * Tutors missing from `stats` are excluded from both pools: no stats row means
 * no evidence, and inventing zeros would let an unsampled tutor win the
 * completeness half.
 */
export function buildMostRequestedTutorIds({
  tutors,
  stats,
  railLength,
  day,
}: MostRequestedInput): string[] | null {
  if (railLength <= 0) return null;
  if (stats.length === 0) return null;

  const statsById = new Map(stats.map((row) => [row.tutor_id, row]));

  const velocity: { id: string; score: number; key: number }[] = [];
  const completeness: { id: string; key: number }[] = [];
  const seen = new Set<string>();

  for (const tutor of tutors) {
    if (seen.has(tutor.id)) continue;
    seen.add(tutor.id);
    const row = statsById.get(tutor.id);
    if (!row) continue;
    const key = dailyTieKey(tutor.id, day);
    // #768 CEO lock 2026-11-13: "high-completeness" means the intake-required
    // public profile + subject/CV fields AND at least one Open hour on the
    // grid. Both halves therefore require open availability.
    const openAvailability = hasOpenAvailability(tutor);
    if (openAvailability) {
      velocity.push({
        id: tutor.id,
        score: row.requests_14d * REQUESTS_14D_WEIGHT + row.saves_14d * SAVES_14D_WEIGHT,
        key,
      });
    }
    if (openAvailability && row.active_cases === 0 && isProfileComplete(tutor)) {
      completeness.push({ id: tutor.id, key });
    }
  }

  // Velocity: strongest demand first; exact score ties rotate by HKT day.
  velocity.sort((a, b) => b.score - a.score || a.key - b.key || a.id.localeCompare(b.id));
  // Completeness carries no ranking, the daily hash is the whole order.
  completeness.sort((a, b) => a.key - b.key || a.id.localeCompare(b.id));

  const velocityQuota = Math.ceil(railLength / 2);
  const completenessQuota = railLength - velocityQuota;
  const selected: string[] = [];
  const used = new Set<string>();

  for (const entry of velocity) {
    if (selected.length >= velocityQuota) break;
    selected.push(entry.id);
    used.add(entry.id);
  }
  for (const entry of completeness) {
    if (selected.length >= velocityQuota + completenessQuota) break;
    if (used.has(entry.id)) continue;
    selected.push(entry.id);
    used.add(entry.id);
  }
  // One pool short of its quota (small catalogue, or a tutor qualifying for
  // both halves): backfill from velocity first, then completeness.
  for (const entry of [...velocity, ...completeness]) {
    if (selected.length >= railLength) break;
    if (used.has(entry.id)) continue;
    selected.push(entry.id);
    used.add(entry.id);
  }

  return selected.length > 0 ? selected : null;
}
