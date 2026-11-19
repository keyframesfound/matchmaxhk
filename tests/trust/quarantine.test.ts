import { describe, expect, it } from "vitest";

import {
  URGENT_SAFETY_REASON,
  UNMATCHED_QUARANTINE_THRESHOLD,
  decideUrgentQuarantine,
  isUrgentSafetyReason,
} from "../../src/features/reports/quarantine";

describe("#782 §2.4 urgent safety auto-quarantine", () => {
  it("only fires for the urgent safety reason", () => {
    expect(isUrgentSafetyReason("urgent_safety")).toBe(true);
    expect(isUrgentSafetyReason("copyright")).toBe(false);
    expect(
      decideUrgentQuarantine({
        reason: "harassment",
        verifiedMatched: true,
        priorUnmatchedReporters: 99,
      }),
    ).toEqual({ quarantine: false, basis: "none" });
  });

  it("AC-755-Q1: one verified-matched report quarantines immediately", () => {
    expect(
      decideUrgentQuarantine({
        reason: URGENT_SAFETY_REASON,
        verifiedMatched: true,
        priorUnmatchedReporters: 0,
      }),
    ).toEqual({ quarantine: true, basis: "verified_matched" });
  });

  it("AC-755-Q2: one unmatched authentic report does not quarantine", () => {
    expect(
      decideUrgentQuarantine({
        reason: URGENT_SAFETY_REASON,
        verifiedMatched: false,
        priorUnmatchedReporters: 0,
      }),
    ).toEqual({ quarantine: false, basis: "none" });
  });

  it("AC-755-Q2: the second unmatched report still does not quarantine", () => {
    expect(
      decideUrgentQuarantine({
        reason: URGENT_SAFETY_REASON,
        verifiedMatched: false,
        priorUnmatchedReporters: 1,
      }),
    ).toEqual({ quarantine: false, basis: "none" });
  });

  it("AC-755-Q2: the third authentic unmatched report quarantines", () => {
    expect(
      decideUrgentQuarantine({
        reason: URGENT_SAFETY_REASON,
        verifiedMatched: false,
        priorUnmatchedReporters: 2,
      }),
    ).toEqual({ quarantine: true, basis: "third_unmatched" });
  });

  it("uses the threshold constant, not a magic number", () => {
    expect(UNMATCHED_QUARANTINE_THRESHOLD).toBe(3);
    const prior = UNMATCHED_QUARANTINE_THRESHOLD - 2;
    expect(
      decideUrgentQuarantine({
        reason: URGENT_SAFETY_REASON,
        verifiedMatched: false,
        priorUnmatchedReporters: prior,
      }),
    ).toEqual({ quarantine: false, basis: "none" });
    expect(
      decideUrgentQuarantine({
        reason: URGENT_SAFETY_REASON,
        verifiedMatched: false,
        priorUnmatchedReporters: prior + 1,
      }),
    ).toEqual({ quarantine: true, basis: "third_unmatched" });
  });
});
