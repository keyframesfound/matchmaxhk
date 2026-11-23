/**
 * #815 §2.11: the two Partner Org lanes, as pure rules.
 *
 * Lane A (centre_overflow) is an org's own student: MatchMax introduces a
 * self-employed educator, the org pays the tutor a net rate off-platform, and
 * the org never pays MatchMax a matching fee. Lane B (parent_referral) is a
 * normal B2C parent case with the referring org recorded.
 *
 * The 30% referral credit to an organisation is NOT part of this module: no
 * organisation payout ledger exists yet, so nothing here computes money.
 */

export const OVERFLOW_ACTIVE_CAP = 3;

export const OVERFLOW_LANES = ["centre_overflow", "parent_referral"] as const;
export type OverflowLane = (typeof OVERFLOW_LANES)[number];

export const OVERFLOW_TAG = "Overflow B2B";

export const OVERFLOW_CAP_MESSAGE =
  "You already have 3 active overflow cases. Close one before posting another.";

export function isOverflowLane(value: unknown): value is OverflowLane {
  return typeof value === "string" && (OVERFLOW_LANES as readonly string[]).includes(value);
}

/** Lane A may post while fewer than three cases are active. */
export function canPostOverflow(activeCount: number): boolean {
  return Number.isInteger(activeCount) && activeCount >= 0 && activeCount < OVERFLOW_ACTIVE_CAP;
}

/** A status that still counts against the cap. */
export function countsAsActiveOverflow(status: string): boolean {
  return !["matched", "closed", "rejected", "released"].includes(status);
}

/** Public referral entry point for lane B (slug validated before use). */
export const REFERRAL_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

export function isReferralSlug(value: unknown): value is string {
  return typeof value === "string" && REFERRAL_SLUG_PATTERN.test(value);
}

export function referralLink(slug: string): string {
  return `/case-request?org=${encodeURIComponent(slug)}`;
}
