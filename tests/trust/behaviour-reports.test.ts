import { describe, expect, it } from "vitest";

import { countStrikes } from "../../src/features/trust/behaviour-reports.functions";

describe("#782 §2.5 concierge strikes (AC-703-2)", () => {
  it("counts only active strikes", () => {
    expect(
      countStrikes([
        { strike: true, voided_at: null },
        { strike: true, voided_at: "2026-11-19T00:00:00Z" },
        { strike: false, voided_at: null },
        { strike: true, voided_at: null },
      ]),
    ).toBe(2);
  });
});
