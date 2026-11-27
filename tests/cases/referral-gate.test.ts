import { describe, expect, it } from "vitest";

import {
  REFERRAL_GATE_REASONS,
  referralGateMessage,
  type ReferralGateReason,
} from "../../src/features/cases/referral-gate";

describe("#625 referral payout gate copy", () => {
  it("maps every SQL reason to a sentence, never a raw code", () => {
    for (const reason of REFERRAL_GATE_REASONS) {
      const message = referralGateMessage(`REFERRAL_GATE:${reason}`);
      expect(message).toBeTruthy();
      expect(message).not.toContain("REFERRAL_GATE");
      expect(message).not.toContain(reason);
    }
  });

  it("maps the two gate failures to the right desk sentence", () => {
    expect(referralGateMessage("REFERRAL_GATE:FEE_NOT_COLLECTED")).toContain("not been collected");
    expect(referralGateMessage("REFERRAL_GATE:PAYOUT_GATE_NOT_MET")).toContain(
      "Lesson 1 and Lesson 2",
    );
  });

  it("ignores errors that are not from the gate", () => {
    expect(referralGateMessage("duplicate key value violates unique constraint")).toBeNull();
    expect(referralGateMessage("REFERRAL_GATE:")).toBeNull();
  });

  it("falls back to the gate sentence for an unknown reason", () => {
    const reason: string = "SOMETHING_NEW";
    expect(referralGateMessage(`REFERRAL_GATE:${reason}`)).toContain("Payout gate not met");
  });

  it("keeps the reason list in sync with the type", () => {
    const typed: ReferralGateReason[] = [...REFERRAL_GATE_REASONS];
    expect(typed).toHaveLength(5);
  });
});
