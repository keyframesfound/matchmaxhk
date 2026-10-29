/**
 * Issue #503, bilateral End Case (pure half).
 *
 * Either party taps End Case on their own surface ("I consider this case
 * finished"). The case becomes Ended — the EXISTING sor_status 'closed' —
 * when BOTH sides have tapped, or when staff force-ends from the SoR desk
 * (transitionCase, already shipped). Ending never waives an unpaid admin fee
 * and never touches phone/fee locks; the record stays on both profiles.
 *
 * Ongoing = sor_status 'fee_paid' | 'active': the post-fee states where
 * lessons continue. Live cases rest at 'fee_paid' (nothing auto-flips to
 * 'active'; only the desk does), so both states are endable — and
 * 'fee_paid->closed' is legal in the SoR transition guard (20261028120000).
 * Pre-fee stages keep the desk as the only closure path.
 */

/** sor_status values where the End Case control shows for both parties. */
export const END_CASE_ELIGIBLE_SOR_STATUSES: readonly string[] = ["fee_paid", "active"];

/** UI gate: can this case show the End Case control right now? */
export function canEndCase(sorStatus: string | null | undefined): boolean {
  return sorStatus != null && END_CASE_ELIGIBLE_SOR_STATUSES.includes(sorStatus);
}

export type CaseEndRole = "parent" | "tutor";

export type CaseEndDecision =
  /** First tap from this side (or an idempotent re-tap): record the marker. */
  | { action: "mark" }
  /** The other side already tapped: record this side AND complete to 'closed'. */
  | { action: "complete" }
  | { action: "reject"; message: "NOT_ONGOING" | "CASE_ENDED" };

/**
 * Decide what an End Case tap does. Pure so the vitest suite can exercise the
 * matrix; the server fn applies the writes (service-role) and repeats nothing.
 */
export function decideCaseEnd(input: {
  sorStatus: string | null | undefined;
  endedByParentAt: string | null | undefined;
  endedByTutorAt: string | null | undefined;
  actorRole: CaseEndRole;
}): CaseEndDecision {
  if (!canEndCase(input.sorStatus)) {
    // 'closed' (already ended) and every non-ongoing state land here; the
    // caller maps 'closed' to CASE_ENDED, everything else to NOT_ONGOING.
    if (input.sorStatus === "closed") return { action: "reject", message: "CASE_ENDED" };
    return { action: "reject", message: "NOT_ONGOING" };
  }
  const mine = input.actorRole === "parent" ? input.endedByParentAt : input.endedByTutorAt;
  const other = input.actorRole === "parent" ? input.endedByTutorAt : input.endedByParentAt;
  if (mine != null) return { action: "mark" }; // idempotent re-tap, no second write
  if (other != null) return { action: "complete" };
  return { action: "mark" };
}

/** Has this side already tapped End Case? */
export function sideHasEnded(
  endedByParentAt: string | null | undefined,
  endedByTutorAt: string | null | undefined,
  role: CaseEndRole,
): boolean {
  return (role === "parent" ? endedByParentAt : endedByTutorAt) != null;
}

/** Is the case fully ended (both markers set or already closed)? */
export function isCaseEnded(input: {
  sorStatus: string | null | undefined;
  endedByParentAt: string | null | undefined;
  endedByTutorAt: string | null | undefined;
}): boolean {
  if (input.sorStatus === "closed") return true;
  return input.endedByParentAt != null && input.endedByTutorAt != null;
}
