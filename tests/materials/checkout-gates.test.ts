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
  pickReusableOrder,
  reusableExistingOrder,
} from "../../src/features/materials/checkout.functions";

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
