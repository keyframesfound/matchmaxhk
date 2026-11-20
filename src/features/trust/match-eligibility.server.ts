/**
 * #782 CEO decisions (2026-11-20): who may be introduced / matched.
 *
 *  - A tutor without a current Safety Attestation cannot be introduced to a
 *    new case (hard block, not "match now, attest later"). Existing cases
 *    and hours logging are untouched.
 *  - A party at strike level 2 (14 days) or 3 (until staff act) gets no NEW
 *    matches; existing cases continue (AC-703-3).
 */

import { selectRows, type Db } from "@/features/cases/desk-db";
import { attestationRequired } from "@/features/trust/safety-attestation";
import {
  INTRO_BLOCK_MESSAGES,
  strikeLadder,
  type StrikeLadderState,
} from "@/features/trust/strike-ladder";

export type IntroBlockReason = "SAFETY_ATTESTATION_REQUIRED" | "MATCH_PAUSED_STRIKES";

/** Active-strike ladder per account (batched). */
export async function ladderByAccount(
  db: Db,
  accountIds: readonly string[],
  now: Date = new Date(),
): Promise<Map<string, StrikeLadderState>> {
  const ids = [...new Set(accountIds.filter(Boolean))];
  const out = new Map<string, StrikeLadderState>();
  if (ids.length === 0) return out;
  const rows = await selectRows<{
    subject_account_id: string;
    strike: boolean;
    voided_at: string | null;
    created_at: string;
  }>(db, "behaviour_reports", "subject_account_id, strike, voided_at, created_at", [
    { col: "subject_account_id", op: "in", value: ids },
  ]);
  const times = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.strike || r.voided_at) continue;
    times.set(r.subject_account_id, [...(times.get(r.subject_account_id) ?? []), r.created_at]);
  }
  for (const id of ids) out.set(id, strikeLadder(times.get(id) ?? [], now));
  return out;
}

/** Tutor ids (tutors.id) that may NOT be introduced right now, with why. */
export async function tutorIntroBlocks(
  db: Db,
  tutorIds: readonly string[],
): Promise<Map<string, IntroBlockReason>> {
  const ids = [...new Set(tutorIds.filter(Boolean))];
  const blocks = new Map<string, IntroBlockReason>();
  if (ids.length === 0) return blocks;
  const tutors = await selectRows<{
    id: string;
    user_id: string | null;
    is_community_seller: boolean | null;
  }>(db, "tutors", "id, user_id, is_community_seller", [{ col: "id", op: "in", value: ids }]);
  const userIds = tutors.map((t) => t.user_id).filter((v): v is string => Boolean(v));
  const [attested, ladders] = await Promise.all([
    userIds.length > 0
      ? selectRows<{ user_id: string; attestation_version: string }>(
          db,
          "safety_attestations",
          "user_id, attestation_version",
          [{ col: "user_id", op: "in", value: userIds }],
        )
      : Promise.resolve([]),
    ladderByAccount(db, userIds),
  ]);
  const versions = new Map<string, string[]>();
  for (const a of attested)
    versions.set(a.user_id, [...(versions.get(a.user_id) ?? []), a.attestation_version]);
  for (const t of tutors) {
    const needsAttestation = attestationRequired({
      hasTutorCard: true,
      // Introductions are tutor-side; a seller-only card is never introduced.
      isCommunitySellerOnly: false,
      acceptedVersions: t.user_id ? (versions.get(t.user_id) ?? []) : [],
    });
    if (needsAttestation) {
      blocks.set(t.id, "SAFETY_ATTESTATION_REQUIRED");
      continue;
    }
    if (t.user_id && ladders.get(t.user_id)?.matchPaused) blocks.set(t.id, "MATCH_PAUSED_STRIKES");
  }
  return blocks;
}

/** Throws the block reason when this tutor cannot be introduced to a new case. */
export async function assertTutorCanBeIntroduced(db: Db, tutorId: string): Promise<void> {
  const reason = (await tutorIntroBlocks(db, [tutorId])).get(tutorId);
  if (reason) throw new Error(INTRO_BLOCK_MESSAGES[reason]);
}

/** Throws PARENT_MATCH_PAUSED_STRIKES when the parent is paused (levels 2-3). */
export async function assertParentCanBeMatched(db: Db, parentId: string | null): Promise<void> {
  if (!parentId) return;
  const state = (await ladderByAccount(db, [parentId])).get(parentId);
  if (state?.matchPaused) throw new Error(INTRO_BLOCK_MESSAGES.PARENT_MATCH_PAUSED_STRIKES);
}
