/**
 * Issue #466: parent-facing match-status stages.
 *
 * Product stages map onto live columns only (no parallel status table):
 * board `tutoring_cases.status` (case_request_status enum) drives the early
 * stages, `matched_tutor_id` marks the tutor introduction, and `sor_status`
 * marks lessons actually running. Display is WhatsApp-first per the copy
 * locks in the issue: never promise in-app scheduling, never imply the
 * parent owes the admin fee (#444 tutor-pays).
 */

import type { SorStatus } from "@/features/cases/sor-db";

export type ParentMatchStage = "received" | "matching" | "tutor_intro" | "lessons" | "closed";

/** Ordered tracker stages; "closed" is a terminal banner, not a tracker step. */
export const MATCH_STAGE_ORDER: ParentMatchStage[] = [
  "received",
  "matching",
  "tutor_intro",
  "lessons",
];

export function getMatchStage(input: {
  status: string;
  matchedTutorId: string | null;
  sorStatus: SorStatus | null;
}): ParentMatchStage {
  const { status, matchedTutorId, sorStatus } = input;
  if (status === "closed" || status === "rejected") return "closed";
  // #449 instant rematch: the parent sees shortlisting again while the desk
  // pivots to the next two tutors (matched_tutor_id may still be set).
  if (status === "failed_trial_pivot") return "matching";
  // Rematch in flight (#449 display-only): back to shortlisting.
  if (sorStatus === "replaced") return "matching";
  if (matchedTutorId) {
    const lessonsRunning = sorStatus != null && sorStatus !== "draft" && sorStatus !== "introduced";
    return lessonsRunning ? "lessons" : "tutor_intro";
  }
  if (status === "contacted" || status === "compliance_hold") return "matching";
  return "received";
}
