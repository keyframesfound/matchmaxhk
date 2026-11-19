/**
 * #782 §2.4 (was #755): Urgent Safety auto-quarantine lock (CEO, do not
 * weaken). Pure so the server and vitest share one rule.
 *
 *  - 1 report from a VERIFIED-MATCHED reporter (a party on a real MatchMax
 *    case with that tutor, or a buyer of that seller's listing) quarantines.
 *  - Unmatched reporters never quarantine alone: 3 distinct authentic
 *    reporters (signed in, past the spam / duplicate / self-report guards)
 *    on the same target are required.
 */

export const URGENT_SAFETY_REASON = "urgent_safety" as const;
export const UNMATCHED_QUARANTINE_THRESHOLD = 3;

/** Report target types that point at a tutor's public profile. */
export const PROFILE_TARGET_TYPES = ["tutor_card", "tutor_photo", "tutor_introduction"] as const;

export type QuarantineTrigger = "verified_report" | "unmatched_threshold";

export function quarantineDecision(input: {
  reporterVerifiedMatched: boolean;
  distinctUnmatchedReporters: number;
}): QuarantineTrigger | null {
  if (input.reporterVerifiedMatched) return "verified_report";
  if (input.distinctUnmatchedReporters >= UNMATCHED_QUARANTINE_THRESHOLD) {
    return "unmatched_threshold";
  }
  return null;
}
