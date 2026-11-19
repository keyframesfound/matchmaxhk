/**
 * #782 §2.1 (was #755): mandatory one-time Safety, Clean Record & Legal
 * Conduct Declaration. Pure rules shared by the server gate and vitest.
 *
 * Who must attest: accounts with a tutor card that is NOT a Community Seller
 * card (the declaration's wording is for tutors). Guests and learners never
 * see it (#759 Option A).
 */

/** Bump to re-prompt every tutor (a new row per version). */
export const SAFETY_ATTESTATION_VERSION = "v1.0";

export const SAFETY_ATTESTATION_CHECKS = [
  "clean_record",
  "zero_illegal",
  "independent_operator",
] as const;
export type SafetyAttestationCheck = (typeof SAFETY_ATTESTATION_CHECKS)[number];

export function allChecksTicked(ticked: Partial<Record<SafetyAttestationCheck, boolean>>): boolean {
  return SAFETY_ATTESTATION_CHECKS.every((check) => ticked[check] === true);
}

/** True when this account must complete the declaration before acting. */
export function attestationRequired(input: {
  hasTutorCard: boolean;
  isCommunitySellerOnly: boolean;
  acceptedVersions: readonly string[];
  currentVersion?: string;
}): boolean {
  if (!input.hasTutorCard || input.isCommunitySellerOnly) return false;
  return !input.acceptedVersions.includes(input.currentVersion ?? SAFETY_ATTESTATION_VERSION);
}

/**
 * #782 §2.2: the parent's "prefer an SCRC tutor" option applies only to
 * face-to-face K-12 requests (hidden for online-only and university).
 * Soft preference: it ranks, it never hides or blocks.
 */
export function scrcPreferenceApplies(input: { academicLevel: string; mode: string }): boolean {
  const k12 =
    input.academicLevel === "Kindergarten" ||
    input.academicLevel === "Primary" ||
    input.academicLevel === "Secondary";
  return k12 && input.mode !== "" && input.mode !== "online";
}
