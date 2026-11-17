import { describe, expect, it } from "vitest";

import {
  automatedSlotOpen,
  emailClassFor,
  promoSubjectsAllowed,
  registerAutomatedMarketingTemplate,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from "../../src/lib/email-templates/email-policy";

describe("#783 email policy", () => {
  it("keeps every existing template transactional", () => {
    for (const name of ["fee-receipt", "fee-reminder", "lesson-update", "action-required"]) {
      expect(emailClassFor(name)).toBe("transactional");
    }
    registerAutomatedMarketingTemplate("tutors-open-slots-digest");
    expect(emailClassFor("tutors-open-slots-digest")).toBe("automated_marketing");
  });

  it("allows one automated email per 7 days", () => {
    const now = new Date("2026-11-17T00:00:00Z");
    expect(automatedSlotOpen(null, now)).toBe(true);
    expect(automatedSlotOpen("2026-11-12T00:00:00Z", now)).toBe(false);
    expect(automatedSlotOpen("2026-11-10T00:00:00Z", now)).toBe(true);
  });

  it("suppresses promo subjects with an active trial or case", () => {
    expect(promoSubjectsAllowed(["IB Biology", "IB Chemistry"], ["IB Biology"])).toEqual([
      "IB Chemistry",
    ]);
    expect(promoSubjectsAllowed(["Biology"], ["IB Biology HL"])).toEqual([]);
  });

  it("signs and verifies a one-click unsubscribe token", async () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    const token = await signUnsubscribeToken(id, "secret");
    expect(await verifyUnsubscribeToken(token, "secret")).toBe(id);
    expect(await verifyUnsubscribeToken(token, "other")).toBeNull();
    expect(await verifyUnsubscribeToken(`${id}.deadbeef`, "secret")).toBeNull();
  });
});
