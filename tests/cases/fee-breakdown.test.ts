import { describe, expect, it } from "vitest";

import {
  derivePaidState,
  fullAdminFeeAmount,
  lesson1Amount,
  lesson2BalanceAmount,
} from "../../src/features/cases/fee-breakdown";

describe("fee breakdown (#385)", () => {
  it("splits the 1.5-lesson admin fee into 100% L1 + 50% L2", () => {
    expect(lesson1Amount(500)).toBe(500);
    expect(lesson2BalanceAmount(500)).toBe(250);
    expect(fullAdminFeeAmount(500)).toBe(750);
    // Whole-HKD rounding on odd rates.
    expect(lesson2BalanceAmount(333)).toBe(167);
    expect(fullAdminFeeAmount(333)).toBe(500);
  });

  it("derives paid states from fee rows", () => {
    const rate = 400;
    expect(derivePaidState([], rate)).toBe("none");
    expect(derivePaidState([{ status: "invoiced", amount_hkd: 600 }], rate)).toBe("none");
    expect(derivePaidState([{ status: "paid", amount_hkd: 400 }], rate)).toBe("partial_l1");
    expect(
      derivePaidState(
        [
          { status: "paid", amount_hkd: 400 },
          { status: "invoiced", amount_hkd: 200 },
        ],
        rate,
      ),
    ).toBe("partial_l1");
    expect(
      derivePaidState(
        [
          { status: "paid", amount_hkd: 400 },
          { status: "paid", amount_hkd: 200 },
        ],
        rate,
      ),
    ).toBe("full");
  });

  it("ignores waived/refunded rows and sub-L1 custom payments", () => {
    const rate = 400;
    expect(derivePaidState([{ status: "waived", amount_hkd: 600 }], rate)).toBe("none");
    expect(derivePaidState([{ status: "refunded", amount_hkd: 600 }], rate)).toBe("none");
    expect(derivePaidState([{ status: "paid", amount_hkd: 120 }], rate)).toBe("none");
  });

  it("returns none without a usable rate", () => {
    expect(derivePaidState([{ status: "paid", amount_hkd: 400 }], null)).toBe("none");
    expect(derivePaidState([{ status: "paid", amount_hkd: 400 }], 0)).toBe("none");
  });

  it("scales group cases by student count, rounding the total once (#391)", () => {
    expect(lesson1Amount(500, 3)).toBe(1500);
    expect(lesson2BalanceAmount(500, 3)).toBe(750);
    expect(fullAdminFeeAmount(500, 3)).toBe(2250);
    // Total-rounding: 0.5 × $333 × 3 → $500 (not 3 × $167 = $501).
    expect(lesson2BalanceAmount(333, 3)).toBe(500);
    expect(fullAdminFeeAmount(333, 3)).toBe(1499);
    // Count <= 0 / fractional falls back to ×1 (legacy rows).
    expect(fullAdminFeeAmount(500, 0)).toBe(750);
    expect(fullAdminFeeAmount(500, 2.5)).toBe(750);
    expect(fullAdminFeeAmount(500, undefined)).toBe(750);
  });

  it("derives paid states against the scaled group target (#391)", () => {
    const rate = 400;
    const count = 2; // full target = 1200, L1 target = 800
    expect(derivePaidState([{ status: "paid", amount_hkd: 400 }], rate, count)).toBe("none");
    expect(derivePaidState([{ status: "paid", amount_hkd: 800 }], rate, count)).toBe("partial_l1");
    expect(
      derivePaidState(
        [
          { status: "paid", amount_hkd: 800 },
          { status: "paid", amount_hkd: 400 },
        ],
        rate,
        count,
      ),
    ).toBe("full");
  });
});
