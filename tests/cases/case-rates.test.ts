// Issue #423 bug 1 — the rate formatter matrix. "HK$?" must NEVER render.
// | min   | max   | Render          |
// |-------|-------|-----------------|
// | set   | set   | HK$300–500/hr   |
// | blank | set   | Up to HK$500/hr |
// | set   | blank | From HK$300/hr  |
// | blank | blank | "" (omit)       |
import { describe, expect, it } from "vitest";

import {
  caseBudgetForTutor,
  formatCaseBudget,
  formatCaseBudgetHkd,
  formatCaseRate,
} from "../../src/features/cases/display";

describe("formatCaseRate matrix (#423)", () => {
  it("renders a range when both bounds are set", () => {
    expect(formatCaseRate(300, 500)).toBe("HK$300–500/hr");
  });

  it("renders 'Up to' when only max is set", () => {
    expect(formatCaseRate(null, 500)).toBe("Up to HK$500/hr");
  });

  it("renders 'From' when only min is set", () => {
    expect(formatCaseRate(300, null)).toBe("From HK$300/hr");
  });

  it("omits the rate entirely when both are blank", () => {
    expect(formatCaseRate(null, null)).toBe("");
  });

  it("accepts undefined like null", () => {
    expect(formatCaseRate(undefined, 500)).toBe("Up to HK$500/hr");
    expect(formatCaseRate(300, undefined)).toBe("From HK$300/hr");
    expect(formatCaseRate(undefined, undefined)).toBe("");
  });

  it("suffixes non-hourly units", () => {
    expect(formatCaseRate(300, 500, "lesson")).toBe("HK$300–500/lesson");
    expect(formatCaseRate(null, 500, "month")).toBe("Up to HK$500/month");
  });
});

describe("formatCaseBudget / formatCaseBudgetHkd (#423)", () => {
  it("delegates to the matrix", () => {
    expect(formatCaseBudget(300, 500)).toBe("HK$300–500/hr");
    expect(formatCaseBudget(null, 500)).toBe("Up to HK$500/hr");
    expect(formatCaseBudget(300, null)).toBe("From HK$300/hr");
    expect(formatCaseBudget(null, null)).toBe("");
  });

  it("formatCaseBudgetHkd uses the HKD-normalized bounds", () => {
    expect(
      formatCaseBudgetHkd({
        budgetMin: null,
        budgetMax: 500,
        budgetMinHkd: null,
        budgetMaxHkd: 500,
      }),
    ).toBe("Up to HK$500/hr");
  });
});

describe("caseBudgetForTutor matrix (#423)", () => {
  const RATES = { GBP: 0.1 };

  it("keeps the HKD original beside the converted primary", () => {
    const { primary, original } = caseBudgetForTutor(
      { budgetMin: null, budgetMax: 500, budgetMinHkd: null, budgetMaxHkd: 500 },
      "GBP",
      RATES,
    );
    expect(primary).toBe("Up to £50/hr");
    expect(original).toBe("Up to HK$500/hr");
  });

  it("converts 'From min' bounds", () => {
    const { primary } = caseBudgetForTutor(
      { budgetMin: 300, budgetMax: null, budgetMinHkd: 300, budgetMaxHkd: null },
      "GBP",
      RATES,
    );
    expect(primary).toBe("From £30/hr");
  });

  it("falls back to HKD when a rate is missing", () => {
    const { primary, original } = caseBudgetForTutor(
      { budgetMin: null, budgetMax: 500, budgetMinHkd: null, budgetMaxHkd: 500 },
      "USD",
      {},
    );
    expect(primary).toBeNull();
    expect(original).toBe("Up to HK$500/hr");
  });

  it("omits everything when both bounds are blank", () => {
    const { primary, original } = caseBudgetForTutor(
      { budgetMin: null, budgetMax: null, budgetMinHkd: null, budgetMaxHkd: null },
      "GBP",
      RATES,
    );
    expect(primary).toBeNull();
    expect(original).toBe("");
  });
});
