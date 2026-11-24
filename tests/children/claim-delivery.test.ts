/**
 * Issue #459 §15.3 hole: a child-claim token is looked up by hash only, so a
 * forwarded invite used to hand a child profile (plus every tutoring case on
 * it — contact and billing view) to whoever opened the link. An email-delivered
 * token is now bound to the address it was sent to.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  claimDeliveryVerdict,
  deliveryTargetIsEmail,
  normalizeClaimEmail,
} from "../../src/features/children/claim.functions";

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

const emailToken = (target: string) =>
  ({ delivery_channel: "email", delivery_target: target }) as const;

describe("normalizeClaimEmail", () => {
  it("trims and lowercases so casing cannot split an identity", () => {
    expect(normalizeClaimEmail("  Anson.Wong@School.EDU ")).toBe("anson.wong@school.edu");
    expect(normalizeClaimEmail(null)).toBe("");
    expect(normalizeClaimEmail(undefined)).toBe("");
  });
});

describe("deliveryTargetIsEmail", () => {
  it("accepts an address", () => {
    expect(deliveryTargetIsEmail("student@example.com")).toBe(true);
  });

  it("rejects phone numbers and junk", () => {
    expect(deliveryTargetIsEmail("+85291234567")).toBe(false);
    expect(deliveryTargetIsEmail("91234567")).toBe(false);
    expect(deliveryTargetIsEmail("student@example")).toBe(false);
    expect(deliveryTargetIsEmail("two words@example.com")).toBe(false);
    expect(deliveryTargetIsEmail("")).toBe(false);
  });
});

describe("claimDeliveryVerdict", () => {
  it("matches the invited address, ignoring casing and whitespace", () => {
    expect(
      claimDeliveryVerdict(emailToken("student@example.com"), {
        email: " Student@Example.com ",
        email_verified: true,
      }),
    ).toBe("match");
  });

  it("refuses a caller signed in as a different address", () => {
    expect(
      claimDeliveryVerdict(emailToken("student@example.com"), {
        email: "stranger@example.com",
        email_verified: true,
      }),
    ).toBe("wrong_account");
    expect(
      claimDeliveryVerdict(emailToken("student@example.com"), {
        email: "student@example.com.evil.test",
      }),
    ).toBe("wrong_account");
  });

  it("fails closed when the caller's claims carry no email", () => {
    expect(claimDeliveryVerdict(emailToken("student@example.com"), {})).toBe("unverified");
    expect(claimDeliveryVerdict(emailToken("student@example.com"), undefined)).toBe("unverified");
    expect(claimDeliveryVerdict(emailToken("student@example.com"), { email: "   " })).toBe(
      "unverified",
    );
  });

  it("fails closed when the email claim is explicitly unverified or the target is corrupt", () => {
    expect(
      claimDeliveryVerdict(emailToken("student@example.com"), {
        email: "student@example.com",
        email_verified: false,
      }),
    ).toBe("unverified");
    // An email-channel token whose target is not an address is corrupt data.
    expect(claimDeliveryVerdict(emailToken("+85291234567"), { email: "student@example.com" })).toBe(
      "unverified",
    );
  });

  it("keeps the old link-holder behaviour for a non-email delivery channel", () => {
    expect(
      claimDeliveryVerdict(
        { delivery_channel: "whatsapp", delivery_target: "+85291234567" },
        { email: "stranger@example.com" },
      ),
    ).toBe("not_bound");
  });
});

describe("acceptChildClaim wiring", () => {
  const src = source("../../src/features/children/claim.functions.ts");

  it("checks the delivery target before the token is consumed", () => {
    const check = src.indexOf("claimDeliveryVerdict(token, context.claims)");
    const consume = src.indexOf(".update({ used_at: now, used_by_user_id: context.userId }");
    expect(check).toBeGreaterThan(-1);
    expect(consume).toBeGreaterThan(-1);
    expect(check).toBeLessThan(consume);
  });

  it("refuses before the students ownership flip and the case migration", () => {
    const check = src.indexOf("claimDeliveryVerdict(token, context.claims)");
    const flip = src.indexOf('status: "claimed_independent"');
    const cases = src.indexOf('{ parent_id: context.userId, who_for: "myself" }');
    expect(flip).toBeGreaterThan(check);
    expect(cases).toBeGreaterThan(check);
  });

  it("reads the delivery channel so a phone token can be told apart", () => {
    expect(src).toContain("delivery_channel, delivery_target");
  });
});
