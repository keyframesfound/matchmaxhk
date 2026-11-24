/**
 * Review-fix tests for the notes-marketplace checkout status machines (PR #305
 * review, 2026-10-12 evening review). Pure-helper design: the TanStart
 * server-fn pipeline can't be driven end-to-end in vitest, so these exercise
 * the extracted gates that the real server fns call (see
 * checkout.functions.ts).
 */
import { describe, expect, it } from "vitest";

import {
  canMarkOrderPaid,
  escapeHtml,
  folderProrationPaidChildGross,
  pickReusableOrder,
  reusableExistingOrder,
} from "../../src/features/materials/checkout.functions";
import {
  computeFolderAdjustedPrice,
  ORDER_GRANTED_STATUSES,
  orderGrantsAccess,
  splitMaterialMoney,
} from "../../src/features/materials/lifecycle";

describe("reusableExistingOrder — refunded orders must not trap re-purchase", () => {
  const order = {
    id: "order-1",
    reference: "MM-123",
    status: "awaiting_payment",
  } as const;

  it("returns the existing order while it is still active", () => {
    for (const status of [
      "awaiting_payment",
      "paid",
      "stamping",
      "delivered",
      "stamp_failed",
      "rejected",
    ]) {
      expect(reusableExistingOrder({ ...order, status })).toEqual({
        orderId: "order-1",
        reference: "MM-123",
      });
    }
  });

  it("returns null for a refunded order — checkout inserts a fresh row instead", () => {
    expect(reusableExistingOrder({ ...order, status: "refunded" })).toBeNull();
  });

  it("returns null when there is no existing order", () => {
    expect(reusableExistingOrder(null)).toBeNull();
  });

  it("nulls out a missing reference into an empty string (page contract)", () => {
    expect(reusableExistingOrder({ id: "o", reference: null, status: "paid" })).toEqual({
      orderId: "o",
      reference: "",
    });
  });
});

describe("pickReusableOrder — refunded + re-bought pair has TWO rows (grok #305 hold-merge)", () => {
  const refundedRow = {
    id: "order-old",
    reference: "MM-OLD",
    status: "refunded",
  } as const;

  it("returns the active re-buy when the pair holds refunded + awaiting_payment", () => {
    expect(
      pickReusableOrder([
        { ...refundedRow },
        { id: "order-new", reference: "MM-NEW", status: "awaiting_payment" },
      ]),
    ).toEqual({ orderId: "order-new", reference: "MM-NEW" });
  });

  it("returns the active row regardless of position (order comes from the query, not the helper)", () => {
    expect(
      pickReusableOrder([
        { id: "order-new", reference: "MM-NEW", status: "paid" },
        { ...refundedRow },
      ]),
    ).toEqual({ orderId: "order-new", reference: "MM-NEW" });
  });

  it("returns null when every row is refunded — checkout inserts fresh", () => {
    expect(pickReusableOrder([{ ...refundedRow }])).toBeNull();
    expect(
      pickReusableOrder([{ ...refundedRow }, { id: "o2", reference: "MM-2", status: "refunded" }]),
    ).toBeNull();
  });

  it("returns null for an empty result", () => {
    expect(pickReusableOrder([])).toBeNull();
  });

  it("single active row still resolves (pre-refund behaviour unchanged)", () => {
    expect(
      pickReusableOrder([{ id: "order-1", reference: "MM-123", status: "awaiting_payment" }]),
    ).toEqual({
      orderId: "order-1",
      reference: "MM-123",
    });
  });
});

describe("canMarkOrderPaid — staff cannot clobber terminal orders", () => {
  it("allows awaiting_payment (the normal flow)", () => {
    expect(canMarkOrderPaid("awaiting_payment")).toBe(true);
  });

  it("allows rejected — the buyer re-pays after a rejected screenshot", () => {
    expect(canMarkOrderPaid("rejected")).toBe(true);
  });

  it("blocks delivered, refunded, stamping, paid, stamp_failed", () => {
    for (const status of ["paid", "stamping", "delivered", "stamp_failed", "refunded"]) {
      expect(canMarkOrderPaid(status)).toBe(false);
    }
  });

  it("blocks unknown statuses (fail closed)", () => {
    expect(canMarkOrderPaid("")).toBe(false);
    expect(canMarkOrderPaid("something_else")).toBe(false);
  });
});

describe("escapeHtml — tutor titles must not inject into receipt HTML", () => {
  it("escapes the dangerous five", () => {
    expect(escapeHtml(`<img src=x onerror="alert('1')">&`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt;&amp;",
    );
  });

  it("leaves plain titles untouched", () => {
    expect(escapeHtml("IB Physics HL — Waves notes 2026")).toBe("IB Physics HL — Waves notes 2026");
  });

  it("escapes already-double-encoded text exactly once (no decoding)", () => {
    expect(escapeHtml("&lt;script&gt;")).toBe("&amp;lt;script&amp;gt;");
  });
});

/**
 * P0 money bug: folder proration only counted `delivered` child orders, so a
 * buyer who already paid for a child through escrow (held) or Stripe
 * (paid_held) was charged the full folder price again. The credit list now
 * derives from ORDER_GRANTED_STATUSES in lifecycle.ts.
 */
describe("folder proration credit — an already-paid child is never charged twice", () => {
  const folderAdjusted = (rows: { status: string; gross_hkd: number | string | null }[]) =>
    computeFolderAdjustedPrice({
      bulkHkd: 100,
      paidChildGross: folderProrationPaidChildGross(rows),
    });

  it("is the full price when the buyer owns no child", () => {
    expect(folderAdjusted([])).toEqual({ ownedSum: 0, adjusted: 100 });
  });

  it("reduces the price for a delivered child", () => {
    expect(folderAdjusted([{ status: "delivered", gross_hkd: 40 }])).toEqual({
      ownedSum: 40,
      adjusted: 60,
    });
  });

  it("reduces the price for an escrow-HELD child (the P0 case)", () => {
    expect(folderAdjusted([{ status: "held", gross_hkd: 40 }])).toEqual({
      ownedSum: 40,
      adjusted: 60,
    });
  });

  it("reduces the price for a Stripe paid_held child (the P0 case)", () => {
    expect(folderAdjusted([{ status: "paid_held", gross_hkd: 40 }])).toEqual({
      ownedSum: 40,
      adjusted: 60,
    });
  });

  it("reduces for every access-granting status, and sums them", () => {
    const rows = ORDER_GRANTED_STATUSES.map((status) => ({ status, gross_hkd: 5 }));
    expect(folderAdjusted(rows)).toEqual({
      ownedSum: 5 * ORDER_GRANTED_STATUSES.length,
      adjusted: Math.max(0, 100 - 5 * ORDER_GRANTED_STATUSES.length),
    });
  });

  it("ignores unpaid, rejected, refunded and frozen children", () => {
    for (const status of [
      "awaiting_payment",
      "paid",
      "stamping",
      "stamp_failed",
      "rejected",
      "refunded",
      "refunded_from_hold",
      "disputed_frozen",
      "cancelled",
    ]) {
      expect(folderAdjusted([{ status, gross_hkd: 40 }]), status).toEqual({
        ownedSum: 0,
        adjusted: 100,
      });
    }
  });

  it("a prorated grant row (gross 0) adds no credit", () => {
    expect(
      folderAdjusted([
        { status: "delivered", gross_hkd: 0 },
        { status: "held", gross_hkd: 40 },
      ]),
    ).toEqual({ ownedSum: 40, adjusted: 60 });
  });

  it("mixed owned + unpaid children only credit the owned ones", () => {
    expect(
      folderAdjusted([
        { status: "delivered", gross_hkd: 30 },
        { status: "held", gross_hkd: 20 },
        { status: "awaiting_payment", gross_hkd: 50 },
        { status: "refunded", gross_hkd: 50 },
      ]),
    ).toEqual({ ownedSum: 50, adjusted: 50 });
  });

  it("string gross values from PostgREST numerics are coerced", () => {
    expect(folderAdjusted([{ status: "held", gross_hkd: "40.5" }])).toEqual({
      ownedSum: 40.5,
      adjusted: 59.5,
    });
  });

  it("the credit list and orderGrantsAccess never drift", () => {
    for (const status of ORDER_GRANTED_STATUSES) {
      expect(orderGrantsAccess(status), status).toBe(true);
      expect(folderProrationPaidChildGross([{ status, gross_hkd: 1 }])).toEqual([1]);
    }
    expect(ORDER_GRANTED_STATUSES).toContain("held");
    expect(ORDER_GRANTED_STATUSES).toContain("paid_held");
    expect(ORDER_GRANTED_STATUSES).not.toContain("awaiting_payment");
  });
});

describe("free-order money (#314): an HK$0 order splits to zero everywhere", () => {
  it("platform fee and tutor net are both 0 for a free pack", () => {
    expect(splitMaterialMoney(0)).toEqual({ platformFeeHkd: 0, tutorNetHkd: 0 });
  });

  it("paid money splits are unchanged", () => {
    expect(splitMaterialMoney(100)).toEqual({ platformFeeHkd: 20, tutorNetHkd: 80 });
  });
});
