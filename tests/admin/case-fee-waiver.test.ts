import { describe, expect, it } from "vitest";

import { caseFeeWaived } from "../../src/features/cases/admin/shared";

// #737 ops visibility: the desk list can only read `source` (the waiver columns
// are not granted to the authenticated role), so the badge must work from any
// of the three signals without a UI change once a grant lands.
describe("#737 caseFeeWaived", () => {
  it("trusts an explicit admin_fee_waived = true", () => {
    expect(caseFeeWaived({ source: "website", admin_fee_waived: true })).toBe(true);
  });

  it("recognises the BYOS_DIRECT case_source stamp", () => {
    expect(caseFeeWaived({ source: "website", case_source: "BYOS_DIRECT" })).toBe(true);
    expect(caseFeeWaived({ source: "byos_direct", case_source: "BYOS_DIRECT" })).toBe(true);
  });

  it("falls back to the granted source column", () => {
    expect(caseFeeWaived({ source: "byos_direct" })).toBe(true);
    // Written by the claim path; tolerate casing and stray whitespace.
    expect(caseFeeWaived({ source: " BYOS_Direct " })).toBe(true);
  });

  it("leaves a plain paid case unbadged", () => {
    expect(caseFeeWaived({ source: "website" })).toBe(false);
    expect(
      caseFeeWaived({ source: "website", case_source: "standard", admin_fee_waived: false }),
    ).toBe(false);
    expect(caseFeeWaived({ source: "", admin_fee_waived: null })).toBe(false);
  });
});
