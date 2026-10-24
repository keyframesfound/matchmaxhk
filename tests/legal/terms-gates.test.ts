import { describe, expect, it } from "vitest";

import { TERMS_VERSION } from "../../src/features/legal/terms";
import { referralSurfaceFor } from "../../src/features/legal/referral-surface";

/**
 * Issue #214 — the pure half of the four terms gates. The acceptance-row
 * insert itself (recordTermsAcceptance) runs against Supabase and is covered
 * by its fail-closed contract in code review; here we pin the rules that are
 * testable without a database.
 */
describe("referralSurfaceFor", () => {
  it("tags submits that arrived through a referrer link as referral_signup", () => {
    expect(referralSurfaceFor("MM-T042")).toBe("referral_signup");
    expect(referralSurfaceFor("  spaced-code  ")).toBe("referral_signup");
  });

  it("keeps plain signup when no referral code reached the payload", () => {
    expect(referralSurfaceFor("")).toBe("signup");
    expect(referralSurfaceFor("   ")).toBe("signup");
    expect(referralSurfaceFor(null)).toBe("signup");
    expect(referralSurfaceFor(undefined)).toBe("signup");
  });

  it("only ever returns the two join-form surfaces", () => {
    for (const code of [undefined, "", "MM-T042"]) {
      expect(["signup", "referral_signup"]).toContain(referralSurfaceFor(code));
    }
  });

  it("terms.ts still pins the version the gates record", () => {
    // Guard against an accidental empty/renamed version: every gate insert
    // defaults to TERMS_VERSION via buildTermsAcceptanceRow.
    expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
