import { describe, expect, it } from "vitest";

import {
  CASE_FLAG_NOTE_MAX,
  CASE_FLAG_REASONS,
  buildCaseFlagRow,
  isCaseFlagReason,
} from "../../src/features/cases/case-flags";

describe("buildCaseFlagRow", () => {
  it("shapes a flag with actor, reason, and note", () => {
    expect(
      buildCaseFlagRow({
        caseId: "case-1",
        actorId: "staff-1",
        actorName: " Austin ",
        reason: "fee_unpaid",
        note: "  two weeks past due  ",
      }),
    ).toEqual({
      case_id: "case-1",
      actor_id: "staff-1",
      actor_name: "Austin",
      reason: "fee_unpaid",
      note: "two weeks past due",
    });
  });

  it("trims an empty note to null", () => {
    expect(
      buildCaseFlagRow({
        caseId: "case-1",
        actorId: "staff-1",
        actorName: null,
        reason: "intro_used",
        note: "   ",
      }).note,
    ).toBeNull();
  });

  it("rejects an unknown reason", () => {
    expect(() =>
      buildCaseFlagRow({
        caseId: "case-1",
        actorId: "staff-1",
        actorName: null,
        reason: "reads_whatsapp",
        note: null,
      }),
    ).toThrow(/unknown flag reason/);
  });

  it("rejects a missing case or actor", () => {
    expect(() =>
      buildCaseFlagRow({
        caseId: "",
        actorId: "staff-1",
        actorName: null,
        reason: "fee_unpaid",
      }),
    ).toThrow(/requires a case/);
    expect(() =>
      buildCaseFlagRow({
        caseId: "case-1",
        actorId: "",
        actorName: null,
        reason: "fee_unpaid",
      }),
    ).toThrow(/requires a staff actor/);
  });

  it("rejects a note over the cap", () => {
    expect(() =>
      buildCaseFlagRow({
        caseId: "case-1",
        actorId: "staff-1",
        actorName: null,
        reason: "fee_unpaid",
        note: "x".repeat(CASE_FLAG_NOTE_MAX + 1),
      }),
    ).toThrow(/at most/);
  });
});

describe("isCaseFlagReason", () => {
  it("accepts exactly the CHECK vocabulary", () => {
    expect(CASE_FLAG_REASONS).toHaveLength(5);
    expect(isCaseFlagReason("off_site_request")).toBe(true);
    expect(isCaseFlagReason("auto_charge")).toBe(false);
    expect(isCaseFlagReason(42)).toBe(false);
  });
});
