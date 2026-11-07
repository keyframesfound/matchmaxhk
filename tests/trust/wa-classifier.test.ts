import { describe, expect, it } from "vitest";

import {
  classifyWhatsAppMessage,
  signIngestBody,
  verifyIngestSignature,
} from "../../src/features/trust/wa-classifier";

describe("WA advisory classifier (#529 §D)", () => {
  it("flags overpayment scams with keyword-only evidence", () => {
    const hits = classifyWhatsAppMessage(
      "I will send a cashier cheque, please refund the difference",
    );
    expect(hits.map((h) => h.flagType)).toEqual(["SCAM_OVERPAYMENT"]);
    expect(hits[0].evidence.length).toBeLessThanOrEqual(80);
  });

  it("flags bypass in 繁中", () => {
    expect(classifyWhatsAppMessage("下個月直接俾錢你啦").map((h) => h.flagType)).toEqual([
      "BYPASS_COLLUSION_RISK",
    ]);
  });

  it("flags hostile clients and bait-and-switch", () => {
    expect(classifyWhatsAppMessage("the dad yelled at me and I feel unsafe")[0].flagType).toBe(
      "HOSTILE_OR_ABUSIVE_CLIENT",
    );
    expect(classifyWhatsAppMessage("my friend will teach lesson 1")[0].flagType).toBe(
      "SCAM_BAIT_AND_SWITCH",
    );
  });

  it("ignores ordinary messages", () => {
    expect(classifyWhatsAppMessage("Can we move Thursday's lesson to 5pm?")).toEqual([]);
    expect(classifyWhatsAppMessage("")).toEqual([]);
  });

  it("verifies HMAC signatures", async () => {
    const body = JSON.stringify({ phone: "91234567", text: "hi" });
    const sig = await signIngestBody(body, "s3cret");
    expect(await verifyIngestSignature(body, sig, "s3cret")).toBe(true);
    expect(await verifyIngestSignature(body, `sha256=${sig}`, "s3cret")).toBe(true);
    expect(await verifyIngestSignature(body, sig, "other")).toBe(false);
    expect(await verifyIngestSignature(body, sig, null)).toBe(false);
  });
});
