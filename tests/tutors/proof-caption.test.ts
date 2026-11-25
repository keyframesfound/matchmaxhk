/**
 * Issue #712 AC-1 — a pinned proof caption is rendered verbatim on the PUBLIC
 * tutor profile, so `saveMyAchievementProofs` must refuse anything that
 * redirects a parent off-platform. The screen reuses `contact-filter.ts`
 * (single source of truth); these tests pin both the refusals and the limits of
 * that shared vocabulary so nobody assumes coverage it does not have.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  PROOF_CONTACT_BLOCKED,
  proofContactViolation,
} from "../../src/features/tutors/proof.functions";

function screen(short_text: string, detail_text?: string) {
  return proofContactViolation([{ short_text, detail_text }]);
}

describe("proofContactViolation", () => {
  it("lets ordinary achievement captions through", () => {
    expect(screen("IBDP 44/45")).toBeNull();
    expect(screen("HKU BSc Mathematics, First Class Honours")).toBeNull();
    expect(screen("DSE 5** in Mathematics and Physics")).toBeNull();
    expect(
      screen("Regional finalist", "Represented Hong Kong at the 2023 regional olympiad."),
    ).toBeNull();
    expect(proofContactViolation([])).toBeNull();
  });

  it("ignores empty and non-string fields instead of throwing", () => {
    expect(proofContactViolation([{ short_text: "   ", detail_text: undefined }])).toBeNull();
    expect(proofContactViolation([{}])).toBeNull();
  });

  it("blocks a plain 8-digit Hong Kong number", () => {
    expect(screen("Call me on 91234567 after the lesson")).toBe(PROOF_CONTACT_BLOCKED);
  });

  it("blocks a spaced or prefixed Hong Kong number", () => {
    expect(screen("Rates on enquiry, WhatsApp 9123 4567")).toBe(PROOF_CONTACT_BLOCKED);
    expect(screen("Phone 9123-4567")).toBe(PROOF_CONTACT_BLOCKED);
    expect(screen("Reach me at +852 9123 4567")).toBe(PROOF_CONTACT_BLOCKED);
  });

  it("blocks an email address", () => {
    expect(screen("Email chan.taiman@example.com for details")).toBe(PROOF_CONTACT_BLOCKED);
  });

  it("blocks a bare wa.me link", () => {
    expect(screen("Wa.me/85291234567")).toBe(PROOF_CONTACT_BLOCKED);
    expect(screen("See https://wa.me/85291234567")).toBe(PROOF_CONTACT_BLOCKED);
  });

  it("blocks channel words wherever they appear", () => {
    expect(screen("DM me on WhatsApp")).toBe(PROOF_CONTACT_BLOCKED);
    expect(screen("WeChat: tutor_mm")).toBe(PROOF_CONTACT_BLOCKED);
    expect(screen("Add me on IG")).toBe(PROOF_CONTACT_BLOCKED);
  });

  it("does not block a bare @handle with no channel word", () => {
    // Truth about the shared helper: contact-filter.ts catches channel NAMES
    // and contact shapes, not social handles on their own. Pinned so a future
    // widening is a deliberate change, not a silent one.
    expect(screen("@mytutor")).toBeNull();
  });

  it("screens detail_text as well as short_text", () => {
    expect(screen("Regional finalist", "Reach me at 9123 4567")).toBe(PROOF_CONTACT_BLOCKED);
  });

  it("returns the same code for every field and every pattern", () => {
    const codes = [
      screen("91234567"),
      screen("chan@example.com"),
      screen("WhatsApp me"),
      screen("Wa.me/85291234567"),
      screen("ok", "9123 4567"),
    ];
    expect(new Set(codes)).toEqual(new Set([PROOF_CONTACT_BLOCKED]));
  });
});

describe("saveMyAchievementProofs wiring", () => {
  const src = readFileSync(
    new URL("../../src/features/tutors/proof.functions.ts", import.meta.url),
    "utf8",
  );

  it("screens the submitted captions before any database work", () => {
    const screenCall = src.indexOf("proofContactViolation(data.achievements)");
    const firstDbWork = src.indexOf("const db = asAdminDb(");
    expect(screenCall).toBeGreaterThan(-1);
    expect(firstDbWork).toBeGreaterThan(-1);
    expect(screenCall).toBeLessThan(firstDbWork);
  });

  it("throws the stable code, not the matched pattern", () => {
    expect(src).toContain("throw new Error(blocked)");
  });
});
