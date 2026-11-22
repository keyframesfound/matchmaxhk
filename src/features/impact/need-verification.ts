/**
 * Issue #794 §2.3 — pro-bono need verification, pure half.
 *
 * Two tiers and no hard gate (#560):
 *   - **Self-Declared** — the default. Absence of a record *is* this state, so a
 *     family that only wrote a context note still reaches tutors.
 *   - **Verified Need** — staff reviewed one proof document. Valid 12 months,
 *     account-level, optionally covering the household's other children.
 *
 * Nothing here touches the document itself: the raw file lives in a private
 * bucket, staff-only, and is deleted on decision. A tutor only ever sees the
 * badge, which is what `badgeKeyFor` decides.
 */

/** A verified pass lasts twelve months from the reviewer's decision. */
export const VERIFICATION_MONTHS = 12;

/** The proof types the desk accepts. Hong Kong has no government lookup API. */
export const PROOF_KINDS = [
  "cssa",
  "wfsfaa_full",
  "wfsfaa_half",
  "working_family_allowance",
  "public_housing",
  "ngo_letter",
  "social_worker_letter",
  "school_letter",
  "other",
] as const;
export type ProofKind = (typeof PROOF_KINDS)[number];

export type VerificationStatus = "pending" | "verified" | "rejected" | "expired";

/** The row shape the state machine reads; `null` = never submitted anything. */
export type VerificationRow = {
  status: VerificationStatus;
  verified_until: string | null;
} | null;

export type NeedState = "self_declared" | "pending" | "verified" | "rejected" | "expired";

function expiresAt(row: VerificationRow, now: Date): boolean {
  if (!row || row.status !== "verified") return false;
  if (!row.verified_until) return true; // a verified row with no expiry is unusable
  const until = Date.parse(row.verified_until);
  return !Number.isFinite(until) || until <= now.getTime();
}

/**
 * The single state the UI reads. A `verified` row whose pass has run out reads
 * as `expired`, not `verified`, so an old approval cannot keep unlocking the
 * verified badge.
 */
export function needState(row: VerificationRow, now: Date): NeedState {
  if (!row) return "self_declared";
  if (row.status === "verified") return expiresAt(row, now) ? "expired" : "verified";
  if (row.status === "pending") return "pending";
  if (row.status === "rejected") return "rejected";
  return "expired";
}

/** Does this account hold a live Verified Need pass right now? */
export function isVerifiedNeed(row: VerificationRow, now: Date): boolean {
  return needState(row, now) === "verified";
}

/**
 * The badge a tutor sees on the private case card. Pending reads as
 * "Verification Pending" but still matches as self-declared material, because
 * matching must never wait on the desk.
 */
export function badgeKeyFor(state: NeedState): string {
  if (state === "verified") return "need_verification.badge_verified";
  if (state === "pending") return "need_verification.badge_pending";
  return "need_verification.badge_self_declared";
}

/** `verified_until` for a decision taken at `reviewedAt`. */
export function verifiedUntilFrom(reviewedAt: Date): string {
  const d = new Date(reviewedAt.getTime());
  d.setUTCMonth(d.getUTCMonth() + VERIFICATION_MONTHS);
  return d.toISOString();
}

/**
 * A new request after expiry is what renews the pass; an existing active
 * pro-bono case is never retro-closed by a lapsed verification (#560).
 */
export function blocksNewRequest(state: NeedState): boolean {
  return state === "pending" || state === "verified";
}
