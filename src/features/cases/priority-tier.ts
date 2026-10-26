/**
 * Issue #438 — manual P1–P4 triage desk.
 *
 * Pure tier vocabulary + desk-bucket logic only (no React, no DB): the
 * admin case list buckets rows with deskBucketForTier and the dropdowns
 * normalize junk with normalizePriorityTier. CEO lock: priority is a
 * MANUAL dropdown only — nothing here sets a tier on its own.
 *
 * Desk buckets (V1): Active Desk = UNASSIGNED + P1 + P2, Hold/Review =
 * P3 + P4. The tier column is text + CHECK in the DB (see migration
 * 20261024130404); rows fetched before the migration applied carry no
 * value and normalize to UNASSIGNED so they always show on Active.
 */

export const PRIORITY_TIERS = ["UNASSIGNED", "P1", "P2", "P3", "P4"] as const;

export type PriorityTier = (typeof PRIORITY_TIERS)[number];

export type DeskBucket = "active" | "hold";

/** Tiers visible on the default Active Desk view. */
export const DESK_ACTIVE_TIERS: readonly PriorityTier[] = ["UNASSIGNED", "P1", "P2"];

/** Tiers visible on the Hold / Review view. */
export const DESK_HOLD_TIERS: readonly PriorityTier[] = ["P3", "P4"];

const TIER_SET: ReadonlySet<string> = new Set<string>(PRIORITY_TIERS);

/** True only for the exact stored vocabulary (no case-folding — the DB CHECK is exact). */
export function isValidPriorityTier(value: unknown): value is PriorityTier {
  return typeof value === "string" && TIER_SET.has(value);
}

/**
 * Coerce any stored/raw value into a PriorityTier. Junk, null and
 * pre-migration rows (column absent) all land on UNASSIGNED — the desk
 * default — instead of crashing a render.
 */
export function normalizePriorityTier(value: unknown): PriorityTier {
  return isValidPriorityTier(value) ? value : "UNASSIGNED";
}

/** Which desk view a tier belongs to. Unknown tiers stay on Active (fail-visible). */
export function deskBucketForTier(value: unknown): DeskBucket {
  const tier = normalizePriorityTier(value);
  return DESK_HOLD_TIERS.includes(tier) ? "hold" : "active";
}

/** Tiers of one desk view, dropdown order (UNASSIGNED first, then P1→P4). */
export function tiersForDesk(bucket: DeskBucket): readonly PriorityTier[] {
  return bucket === "hold" ? DESK_HOLD_TIERS : DESK_ACTIVE_TIERS;
}
