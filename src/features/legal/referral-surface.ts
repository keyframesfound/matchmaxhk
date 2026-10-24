import type { TermsSurface } from "./terms";

/**
 * Issue #214: the /join form renders ONE terms checkbox but can record two
 * surfaces. A submit that arrived through a referrer link (?ref=, remembered
 * by readStoredReferralCode and carried in the payload's referralCode) is
 * tagged "referral_signup"; every other submit is plain "signup". Pure so
 * tests/legal/terms-gates.test.ts can pin the rule the server fn applies.
 */
export function referralSurfaceFor(
  referralCode: string | null | undefined,
): Extract<TermsSurface, "signup" | "referral_signup"> {
  return referralCode != null && referralCode.trim() !== "" ? "referral_signup" : "signup";
}
