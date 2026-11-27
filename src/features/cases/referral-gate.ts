/**
 * #625 — referral / agent cash payout gate, client copy.
 *
 * The gate itself is enforced in Postgres (`referral_payout_gate` plus the
 * `trg_referral_bounty_payout_gate` trigger). PostgREST surfaces a blocked
 * transition as `REFERRAL_GATE:<REASON>`; this module turns that into the desk
 * sentence, so the admin table never shows a raw constraint error.
 */

export const REFERRAL_GATE_REASONS = [
  "BOUNTY_NOT_FOUND",
  "NO_SOURCE_CASE",
  "CASE_NOT_FOUND",
  "FEE_NOT_COLLECTED",
  "PAYOUT_GATE_NOT_MET",
] as const;

export type ReferralGateReason = (typeof REFERRAL_GATE_REASONS)[number];

const COPY: Record<ReferralGateReason, string> = {
  BOUNTY_NOT_FOUND: "That bounty no longer exists. Refresh and try again.",
  NO_SOURCE_CASE:
    "This bounty has no source case, so the gate cannot be checked. Recreate it from a fee-collected case.",
  CASE_NOT_FOUND: "The linked case could not be found. Refresh and try again.",
  FEE_NOT_COLLECTED:
    "The admin fee for this case has not been collected. Record the payment first.",
  PAYOUT_GATE_NOT_MET:
    "Payout gate not met. Lesson 1 and Lesson 2 must be done, or the case must be settled with a known final fee.",
};

/**
 * `null` when the error did not come from the referral gate, so callers can
 * fall back to the original message.
 */
export function referralGateMessage(error: string): string | null {
  const match = /REFERRAL_GATE:([A-Z_]+)/.exec(error);
  if (!match) return null;
  return COPY[match[1] as ReferralGateReason] ?? COPY.PAYOUT_GATE_NOT_MET;
}
