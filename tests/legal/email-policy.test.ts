import { describe, expect, it } from "vitest";

import {
  AUTOMATED_EMAIL_WINDOW_MS,
  automatedSlotOpen,
  emailClassFor,
  promoDecision,
  promoSubjectsAllowed,
  registerAutomatedMarketingTemplate,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from "../../src/lib/email-templates/email-policy";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-23T12:00:00Z");

describe("#783 §2.3 email policy — the 7-day automated cap", () => {
  it("treats receipts and lifecycle mail as transactional, the digest as marketing", () => {
    for (const t of ["fee-receipt", "order-delivered", "account-status", "action-required"]) {
      expect(emailClassFor(t)).toBe("transactional");
    }
    expect(emailClassFor("weekly-digest")).toBe("automated_marketing");
    expect(emailClassFor("not-a-template")).toBe("transactional");
  });

  it("opens the slot when nothing was ever sent", () => {
    expect(automatedSlotOpen(null, NOW)).toBe(true);
    expect(automatedSlotOpen("", NOW)).toBe(true);
  });

  it("closes the slot at 6d 23h and opens it at exactly 7 days", () => {
    const sixDays = new Date(NOW.getTime() - 6 * DAY).toISOString();
    const exactlySeven = new Date(NOW.getTime() - AUTOMATED_EMAIL_WINDOW_MS).toISOString();
    expect(automatedSlotOpen(sixDays, NOW)).toBe(false);
    expect(automatedSlotOpen(exactlySeven, NOW)).toBe(true);
  });

  it("fails open on an unparseable timestamp rather than blocking mail forever", () => {
    expect(automatedSlotOpen("not-a-date", NOW)).toBe(true);
  });

  it("drops promos for subjects the parent already has a trial or case in", () => {
    const allowed = promoSubjectsAllowed(
      ["Physics", "Chemistry", "Biology"],
      ["physics", "  CHEMISTRY  "],
    );
    expect(allowed).toEqual(["Biology"]);
  });

  it("returns nothing when every promo subject is already active", () => {
    expect(promoSubjectsAllowed(["Maths"], ["maths"]).length).toBe(0);
  });

  it("keeps every promo subject when there is no active case", () => {
    expect(promoSubjectsAllowed(["Maths", "Physics"], [])).toEqual(["Maths", "Physics"]);
  });

  it("lets a new template register as marketing", () => {
    registerAutomatedMarketingTemplate("promo-test");
    expect(emailClassFor("promo-test")).toBe("automated_marketing");
  });
});

const USER_A = "3f2b8c1e-9a4d-4c77-8f10-2b6d5e9c7a11";
const USER_B = "7c1d4e2f-8b3a-4d65-9e02-1a5c8f7b6d33";

describe("#783 §2.3 unsubscribe token", () => {
  it("round-trips a signed token to the user id", async () => {
    const token = await signUnsubscribeToken(USER_A, "secret");
    expect(await verifyUnsubscribeToken(token, "secret")).toBe(USER_A);
  });

  it("rejects a tampered user id and a wrong secret", async () => {
    const token = await signUnsubscribeToken(USER_A, "secret");
    const [, signature] = token.split(".");
    // Swapping in another real uuid must fail the signature check, not just
    // the uuid shape check.
    expect(await verifyUnsubscribeToken(`${USER_B}.${signature}`, "secret")).toBeNull();
    expect(await verifyUnsubscribeToken(token, "other-secret")).toBeNull();
  });

  it("rejects a non-uuid subject", async () => {
    const token = await signUnsubscribeToken("user-1", "secret");
    expect(await verifyUnsubscribeToken(token, "secret")).toBeNull();
  });

  it("rejects a malformed token", async () => {
    expect(await verifyUnsubscribeToken("garbage", "secret")).toBeNull();
    expect(await verifyUnsubscribeToken("a.b.c", "secret")).toBeNull();
  });
});

describe("#783 AC-717-2 promo suppression decision", () => {
  it("drops subjects the recipient already has an active trial or case in", () => {
    const decision = promoDecision(["IB Physics", "DSE Maths", "IGCSE Biology"], ["DSE maths"]);
    expect(decision.send).toBe(true);
    expect(decision.subjects).toEqual(["IB Physics", "IGCSE Biology"]);
  });

  it("suppresses the whole send when every subject is already active", () => {
    const decision = promoDecision(["IB Physics"], ["IB Physics HL"]);
    expect(decision).toEqual({ send: false, subjects: [] });
  });

  it("suppresses an empty candidate list rather than sending a blank promo", () => {
    expect(promoDecision([], [])).toEqual({ send: false, subjects: [] });
  });

  it("keeps the send when the recipient has no active matches", () => {
    expect(promoDecision(["IB Physics"], [])).toEqual({ send: true, subjects: ["IB Physics"] });
  });
});
