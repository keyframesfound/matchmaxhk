import { describe, expect, it } from "vitest";

import {
  quarantineDecision,
  UNMATCHED_QUARANTINE_THRESHOLD,
} from "../../src/features/trust/quarantine";
import { P1_REPORT_REASONS } from "../../src/features/materials/marketplace-policy";
import { REPORT_REASONS } from "../../src/features/reports/reports.functions";

describe("#782 §2.4 Urgent Safety quarantine lock", () => {
  it("quarantines on one verified-matched report (AC-755-Q1)", () => {
    expect(
      quarantineDecision({ reporterVerifiedMatched: true, distinctUnmatchedReporters: 1 }),
    ).toBe("verified_report");
  });

  it("needs 3 distinct unmatched reporters (AC-755-Q2)", () => {
    expect(UNMATCHED_QUARANTINE_THRESHOLD).toBe(3);
    expect(
      quarantineDecision({ reporterVerifiedMatched: false, distinctUnmatchedReporters: 1 }),
    ).toBeNull();
    expect(
      quarantineDecision({ reporterVerifiedMatched: false, distinctUnmatchedReporters: 2 }),
    ).toBeNull();
    expect(
      quarantineDecision({ reporterVerifiedMatched: false, distinctUnmatchedReporters: 3 }),
    ).toBe("unmatched_threshold");
  });

  it("keeps the ordinary reasons and adds urgent safety (AC-755-Q4)", () => {
    expect(REPORT_REASONS[0]).toBe("urgent_safety");
    for (const r of ["contact_details", "copyright", "harassment", "not_as_described", "other"]) {
      expect(REPORT_REASONS).toContain(r);
    }
    expect(P1_REPORT_REASONS).toContain("urgent_safety");
  });
});
