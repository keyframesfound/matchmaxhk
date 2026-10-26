/**
 * Issue #477: tutor-applicant status stages.
 *
 * Product stages map onto live columns only (no parallel status table):
 * `tutor_applications.status` (tutor_application_status enum: pending |
 * accepted | rejected) drives the flow and `linked_tutor_id` marks the tutor
 * card that was published from the application (#310 go-live-on-submit — the
 * publish RPC stamps both at submit).
 *
 * NEEDS_INFO has NO live column today: since #310 the admin join-requests
 * desk is a read-only archive with no write path that records missing items
 * on the row. The stage stays reserved and data-driven — the server payload
 * carries `needsInfoItems: string[]`, which is empty until a live field
 * produces items, and the checklist renders ONLY from that array (never
 * generic copy). Open question for Ryan in PR #477's description.
 */

export type ApplicationStage = "submitted" | "review" | "needs_info" | "approved" | "rejected";

/** Ordered tracker stages; "rejected" is a terminal banner, not a step. */
export const APPLICATION_STAGE_ORDER: ApplicationStage[] = [
  "submitted",
  "review",
  "needs_info",
  "approved",
];

export type ApplicationStatusInput = {
  /** Raw `tutor_applications.status` (pending | accepted | rejected). */
  status: string;
  /** Raw `tutor_applications.linked_tutor_id` (card published from this row). */
  linkedTutorId: string | null;
  /** Exact missing items from live data; empty until a needs-info field exists. */
  needsInfoItems: string[];
};

export function getApplicationStage(input: ApplicationStatusInput): ApplicationStage {
  const { status, linkedTutorId, needsInfoItems } = input;
  if (status === "rejected") return "rejected";
  // #310: the card publishes at submit — accepted (or an explicit link)
  // means approved, even if staff later unpublish the card (the panel copy
  // then stays factual about liveness instead of claiming it).
  if (status === "accepted" || linkedTutorId != null) return "approved";
  // The issue flow keeps NEEDS_INFO strictly before APPROVED, so a pending
  // row with live missing items parks there; the desk can bounce it back to
  // under review by clearing the items.
  if (needsInfoItems.length > 0) return "needs_info";
  return "review";
}
