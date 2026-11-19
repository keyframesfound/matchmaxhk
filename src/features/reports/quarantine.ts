/**
 * #782 §2.4 auto-quarantine decision (pure, no DB, no server imports).
 *
 * Rules (CEO, do not weaken):
 *  - 1 verified-matched urgent safety report quarantines immediately.
 *    "Verified-matched" = the reporter is a party on a real MatchMax case
 *    involving that tutor (or the listing's seller), not a stranger click.
 *  - An unmatched reporter never quarantines alone. The 3rd authentic
 *    unmatched urgent safety report on the same target does.
 *    "Authentic" = signed-in and past the existing duplicate / self-report /
 *    spam guards in reports.functions.ts; no paid-KYC is invented here.
 */

/** The single P0 reason added to the shipped report reasons (#782 §2.4). */
export const URGENT_SAFETY_REASON = "urgent_safety";

/** Authentic unmatched reporters required before auto-quarantine kicks in. */
export const UNMATCHED_QUARANTINE_THRESHOLD = 3;

export type QuarantineBasis = "verified_matched" | "third_unmatched" | "none";

export type UrgentQuarantineInput = {
  reason: string;
  /** The reporter is a party on a real case with the reported tutor/seller. */
  verifiedMatched: boolean;
  /**
   * Distinct authentic unmatched reporters with an OPEN urgent safety report
   * on the same target, excluding the current reporter (the unique
   * one-open-report-per-reporter index already blocked repeats).
   */
  priorUnmatchedReporters: number;
};

export type UrgentQuarantineDecision = {
  quarantine: boolean;
  basis: QuarantineBasis;
};

export function isUrgentSafetyReason(reason: string): boolean {
  return reason === URGENT_SAFETY_REASON;
}

export function decideUrgentQuarantine(input: UrgentQuarantineInput): UrgentQuarantineDecision {
  if (!isUrgentSafetyReason(input.reason)) return { quarantine: false, basis: "none" };
  if (input.verifiedMatched) return { quarantine: true, basis: "verified_matched" };
  // This report is the (prior + 1)-th authentic unmatched one; quarantine on
  // the 3rd, i.e. when at least two prior distinct unmatched reporters exist.
  if (input.priorUnmatchedReporters >= UNMATCHED_QUARANTINE_THRESHOLD - 1) {
    return { quarantine: true, basis: "third_unmatched" };
  }
  return { quarantine: false, basis: "none" };
}
