/**
 * Review-blocker tests for the materials orders money paths (PR #291 review,
 * blocker 8). Pure-helper design: the TanStart server-fn pipeline can't be
 * driven end-to-end in vitest, so these exercise the extracted gates that the
 * real server fns call (see orders.functions.ts).
 */
import { describe, expect, it } from "vitest";

import {
  assertOwnedDeliveredOrder,
  assertValidGrantRow,
  buildPayoutCsv,
  isUniqueViolation,
  parsePayoutMonthWindow,
  PAYOUT_CSV_HEADER,
  type PayoutCsvRow,
} from "../../src/features/materials/orders.functions";

describe("assertOwnedDeliveredOrder — unlock gating", () => {
  const buyer = "acct-1";

  it("denies when there is no order at all", () => {
    expect(() => assertOwnedDeliveredOrder(null, buyer)).toThrow(
      "This pack is not unlocked for your account.",
    );
  });

  it("denies when the order exists but is not delivered", () => {
    expect(() =>
      assertOwnedDeliveredOrder({ buyer_account_id: buyer, status: "paid" }, buyer),
    ).toThrow("This pack is not unlocked for your account.");
  });

  it("denies another buyer's delivered order", () => {
    expect(() =>
      assertOwnedDeliveredOrder({ buyer_account_id: "acct-2", status: "delivered" }, buyer),
    ).toThrow("This pack is not unlocked for your account.");
  });

  it("the missing-order error is IDENTICAL to the undelivered error (no oracle leak)", () => {
    let missing = "";
    let undelivered = "";
    try {
      assertOwnedDeliveredOrder(null, buyer);
    } catch (e) {
      missing = (e as Error).message;
    }
    try {
      assertOwnedDeliveredOrder({ buyer_account_id: buyer, status: "paid" }, buyer);
    } catch (e) {
      undelivered = (e as Error).message;
    }
    expect(missing).toBe(undelivered);
  });

  it("allows the buyer's own delivered order", () => {
    expect(() =>
      assertOwnedDeliveredOrder({ buyer_account_id: buyer, status: "delivered" }, buyer),
    ).not.toThrow();
  });
});

describe("assertValidGrantRow — grants stay HK$0 (mirrors the migration CHECK)", () => {
  const zero = {
    is_grant: true,
    gross_hkd: 0,
    platform_fee_hkd: 0,
    tutor_net_hkd: 0,
    status: "delivered",
  } as const;

  it("accepts a clean HK$0 delivered grant", () => {
    expect(() => assertValidGrantRow(zero)).not.toThrow();
  });

  it("rejects a grant with positive net (service-role injection attempt)", () => {
    expect(() => assertValidGrantRow({ ...zero, tutor_net_hkd: 100 })).toThrow(
      "A grant order must be HK$0",
    );
  });

  it("rejects a grant with nonzero fee or gross", () => {
    expect(() => assertValidGrantRow({ ...zero, platform_fee_hkd: 1 })).toThrow();
    expect(() => assertValidGrantRow({ ...zero, gross_hkd: 1 })).toThrow();
  });

  it("rejects a grant that is not delivered", () => {
    expect(() => assertValidGrantRow({ ...zero, status: "paid" })).toThrow(
      "A grant order must be delivered",
    );
  });

  it("ignores non-grant rows (real purchases carry money)", () => {
    expect(() =>
      assertValidGrantRow({
        is_grant: false,
        gross_hkd: 280,
        platform_fee_hkd: 56,
        tutor_net_hkd: 224,
        status: "delivered",
      }),
    ).not.toThrow();
  });
});

describe("isUniqueViolation — duplicate-grant detection", () => {
  it("detects via the structured Postgres code", () => {
    expect(isUniqueViolation({ code: "23505", message: "weird wording" })).toBe(true);
  });

  it("keeps the message fallback for clients that drop the code", () => {
    expect(
      isUniqueViolation({ message: 'duplicate key value violates unique constraint "x"' }),
    ).toBe(true);
  });

  it("is false for other errors and null", () => {
    expect(isUniqueViolation({ code: "23503", message: "foreign key" })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});

describe("parsePayoutMonthWindow — month boundaries (HKT)", () => {
  it("builds a half-open [first, next-first) window", () => {
    const w = parsePayoutMonthWindow("2026-10");
    expect(w.from).toBe("2026-10-01");
    expect(w.to).toBe("2026-11-01");
    expect(w.fromIso).toBe("2026-10-01T00:00:00+08:00");
    expect(w.toIso).toBe("2026-11-01T00:00:00+08:00");
  });

  it("wraps December into the next year", () => {
    const w = parsePayoutMonthWindow("2026-12");
    expect(w.to).toBe("2027-01-01");
  });

  it("rejects malformed months", () => {
    expect(() => parsePayoutMonthWindow("2026-13")).toThrow("YYYY-MM");
    expect(() => parsePayoutMonthWindow("october")).toThrow("YYYY-MM");
    expect(() => parsePayoutMonthWindow("2026-1")).toThrow("YYYY-MM");
  });
});

describe("buildPayoutCsv — CSV rendering", () => {
  const row: PayoutCsvRow = {
    id: "ord-1",
    delivered_at: "2026-10-05T02:00:00+08:00",
    tutor_id: "tut-9",
    gross_hkd: "280",
    platform_fee_hkd: "56",
    tutor_net_hkd: "224",
    digital_materials: { title: 'Pack "Alpha", 2026' },
    tutors: { display_name: "Chan Tai Man" },
  };

  it("starts with the shared header", () => {
    expect(buildPayoutCsv([row]).split("\n")[0]).toBe(PAYOUT_CSV_HEADER);
  });

  it("escapes quotes in text fields and keeps money to 2dp", () => {
    const csv = buildPayoutCsv([row]);
    expect(csv).toContain('"Pack ""Alpha"", 2026"');
    expect(csv).toContain("280.00,56.00,224.00");
  });

  it("renders zero rows as header-only", () => {
    expect(buildPayoutCsv([])).toBe(PAYOUT_CSV_HEADER);
  });
});
