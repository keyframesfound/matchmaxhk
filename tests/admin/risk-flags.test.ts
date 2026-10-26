import { describe, expect, it } from "vitest";

import {
  RISK_FLAGS,
  RISK_FLAG_BADGE_CLASS,
  RISK_FLAG_LABELS,
  buildRiskPatch,
  canSetRiskFlag,
  isRiskFlag,
  normalizeRiskFlag,
} from "../../src/features/admin/risk-flags";

describe("risk flag vocabulary", () => {
  it("exposes exactly NONE / REVIEW / BLOCKED", () => {
    expect([...RISK_FLAGS]).toEqual(["NONE", "REVIEW", "BLOCKED"]);
  });

  it("accepts only stored vocabulary values", () => {
    expect(isRiskFlag("REVIEW")).toBe(true);
    expect(isRiskFlag("BLOCKED")).toBe(true);
    expect(isRiskFlag("NONE")).toBe(true);
    expect(isRiskFlag("review")).toBe(false);
    expect(isRiskFlag("")).toBe(false);
    expect(isRiskFlag(null)).toBe(false);
    expect(isRiskFlag(undefined)).toBe(false);
    expect(isRiskFlag(42)).toBe(false);
  });

  it("normalizes junk, absent, and pre-migration values to NONE", () => {
    expect(normalizeRiskFlag("REVIEW")).toBe("REVIEW");
    expect(normalizeRiskFlag("AUTO_BLOCK")).toBe("NONE");
    expect(normalizeRiskFlag("")).toBe("NONE");
    expect(normalizeRiskFlag(null)).toBe("NONE");
    expect(normalizeRiskFlag(undefined)).toBe("NONE");
  });

  it("styles REVIEW as warning and BLOCKED as destructive; NONE has no badge", () => {
    expect(RISK_FLAG_BADGE_CLASS.NONE).toBe("");
    expect(RISK_FLAG_BADGE_CLASS.REVIEW).toMatch(/amber/);
    expect(RISK_FLAG_BADGE_CLASS.BLOCKED).toMatch(/red/);
    // Every flag has both an English fallback and a badge class entry.
    for (const flag of RISK_FLAGS) {
      expect(RISK_FLAG_LABELS[flag].length).toBeGreaterThan(0);
      expect(RISK_FLAG_BADGE_CLASS[flag]).toBeDefined();
    }
  });
});

describe("canSetRiskFlag (Operator-gated BLOCKED)", () => {
  it("lets any CS set and clear REVIEW", () => {
    expect(canSetRiskFlag({ current: "NONE", next: "REVIEW", operatorAuthority: false }).ok).toBe(
      true,
    );
    expect(canSetRiskFlag({ current: "REVIEW", next: "NONE", operatorAuthority: false }).ok).toBe(
      true,
    );
  });

  it("requires Operator authority to set BLOCKED", () => {
    expect(
      canSetRiskFlag({ current: "REVIEW", next: "BLOCKED", operatorAuthority: false }),
    ).toEqual({ ok: false, reason: "operator_required" });
    expect(canSetRiskFlag({ current: "NONE", next: "BLOCKED", operatorAuthority: false })).toEqual({
      ok: false,
      reason: "operator_required",
    });
    expect(canSetRiskFlag({ current: "REVIEW", next: "BLOCKED", operatorAuthority: true }).ok).toBe(
      true,
    );
  });

  it("requires Operator authority to clear BLOCKED (un-block is an Operator action)", () => {
    expect(
      canSetRiskFlag({ current: "BLOCKED", next: "REVIEW", operatorAuthority: false }),
    ).toEqual({ ok: false, reason: "operator_required" });
    expect(canSetRiskFlag({ current: "BLOCKED", next: "NONE", operatorAuthority: false }).ok).toBe(
      false,
    );
    expect(canSetRiskFlag({ current: "BLOCKED", next: "NONE", operatorAuthority: true }).ok).toBe(
      true,
    );
  });

  it("treats re-saving the same flag as a no-op", () => {
    expect(
      canSetRiskFlag({ current: "BLOCKED", next: "BLOCKED", operatorAuthority: false }).ok,
    ).toBe(true);
    expect(canSetRiskFlag({ current: "REVIEW", next: "REVIEW", operatorAuthority: false }).ok).toBe(
      true,
    );
  });
});

describe("buildRiskPatch", () => {
  const now = new Date("2026-10-24T05:00:00.000Z");

  it("stamps actor + time when setting a flag", () => {
    expect(
      buildRiskPatch({ next: "REVIEW", note: "  caller mismatch  ", actorId: "staff-1", now }),
    ).toEqual({
      risk_flag: "REVIEW",
      risk_note: "caller mismatch",
      risk_flagged_at: "2026-10-24T05:00:00.000Z",
      risk_flagged_by: "staff-1",
    });
  });

  it("clears the note and audit stamp when the flag returns to NONE", () => {
    expect(buildRiskPatch({ next: "NONE", note: "old reason", actorId: "staff-1", now })).toEqual({
      risk_flag: "NONE",
      risk_note: null,
      risk_flagged_at: null,
      risk_flagged_by: null,
    });
  });

  it("trims an empty note to null and caps the note length", () => {
    const set = buildRiskPatch({ next: "BLOCKED", note: "   ", actorId: "staff-1", now });
    expect(set.risk_note).toBeNull();

    const long = buildRiskPatch({ next: "BLOCKED", note: "x".repeat(400), actorId: null, now });
    expect(long.risk_note).toHaveLength(280);
    expect(long.risk_flagged_by).toBeNull();
  });

  it("normalizes junk flag values to NONE instead of writing them", () => {
    expect(buildRiskPatch({ next: "AUTO_BLOCK", actorId: "staff-1", now }).risk_flag).toBe("NONE");
  });
});
