import { describe, expect, it } from "vitest";

import {
  buildPayoutPreview,
  payoutPreviewCsv,
  type PayoutDetails,
  type PayoutLedgerRow,
  type PayoutSeller,
} from "../../src/features/materials/payout-batch";

const sellers: PayoutSeller[] = [
  { user_id: "u1", display_name: "Alice", tutor_code: "MM-T001" },
  { user_id: "u2", display_name: "Bob", tutor_code: "MM-T002" },
  { user_id: "u3", display_name: "Cara", tutor_code: "MM-T003" },
];
const details: PayoutDetails[] = [
  { user_id: "u1", payout_method: "fps_phone", payee_name: "Alice Chan" },
  { user_id: "u2", payout_method: "bank_account", payee_name: "Bob Lee" },
];

describe("#784 §2.2 weekly payout preview", () => {
  it("sums the signed ledger per seller and pays the whole balance over HK$50", () => {
    const entries: PayoutLedgerRow[] = [
      { user_id: "u1", amount_hkd: 60 },
      { user_id: "u1", amount_hkd: "40.5" },
      { user_id: "u1", amount_hkd: -10 },
    ];
    const preview = buildPayoutPreview(entries, sellers, details);
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0]).toMatchObject({
      userId: "u1",
      sellerName: "Alice",
      balanceHkd: 90.5,
      dueHkd: 90.5,
      method: "fps_phone",
      payeeName: "Alice Chan",
      belowMinimum: false,
      missingDetails: false,
    });
    expect(preview.dueTotalHkd).toBe(90.5);
    expect(preview.dueCount).toBe(1);
  });

  it("rolls over a seller under the HK$50 minimum instead of paying them", () => {
    const preview = buildPayoutPreview([{ user_id: "u3", amount_hkd: 49.99 }], sellers, details);
    expect(preview.rows[0]).toMatchObject({ dueHkd: 0, belowMinimum: true, balanceHkd: 49.99 });
    expect(preview.belowMinimumCount).toBe(1);
    expect(preview.dueCount).toBe(0);
    expect(preview.dueTotalHkd).toBe(0);
  });

  it("keeps a carried negative balance visible but not payable", () => {
    const preview = buildPayoutPreview(
      [
        { user_id: "u1", amount_hkd: 80 },
        { user_id: "u2", amount_hkd: -20 },
      ],
      sellers,
      details,
    );
    const bob = preview.rows.find((row) => row.userId === "u2");
    expect(bob).toMatchObject({ balanceHkd: -20, dueHkd: 0, belowMinimum: false });
    expect(preview.dueTotalHkd).toBe(80);
  });

  it("flags a due seller with no payout details on file", () => {
    const preview = buildPayoutPreview([{ user_id: "u3", amount_hkd: 120 }], sellers, details);
    expect(preview.rows[0].missingDetails).toBe(true);
    expect(preview.missingDetailsCount).toBe(1);
  });

  it("omits zero balances and orders the run largest first", () => {
    const preview = buildPayoutPreview(
      [
        { user_id: "u1", amount_hkd: 55 },
        { user_id: "u2", amount_hkd: 300 },
        { user_id: "u3", amount_hkd: 0 },
      ],
      sellers,
      details,
    );
    expect(preview.rows.map((row) => row.userId)).toEqual(["u2", "u1"]);
    expect(preview.dueTotalHkd).toBe(355);
    expect(preview.dueCount).toBe(2);
  });

  it("needs a manager sign-off once offsets in the run reach HK$500", () => {
    const under = buildPayoutPreview(
      [
        { user_id: "u1", amount_hkd: 600, kind: "sale_net" },
        { user_id: "u1", amount_hkd: -100, kind: "refund_offset" },
      ],
      sellers,
      details,
    );
    expect(under.adjustmentHkd).toBe(100);
    expect(under.needsManagerApproval).toBe(false);

    const at = buildPayoutPreview(
      [
        { user_id: "u1", amount_hkd: 900, kind: "sale_net" },
        { user_id: "u1", amount_hkd: -500, kind: "chargeback_offset" },
      ],
      sellers,
      details,
    );
    expect(at.adjustmentHkd).toBe(500);
    expect(at.needsManagerApproval).toBe(true);
  });

  it("ignores offsets belonging to sellers who are not being paid", () => {
    const preview = buildPayoutPreview(
      [
        { user_id: "u1", amount_hkd: 80, kind: "sale_net" },
        { user_id: "u3", amount_hkd: -900, kind: "adjustment" },
      ],
      sellers,
      details,
    );
    expect(preview.rows.find((row) => row.userId === "u3")?.dueHkd).toBe(0);
    expect(preview.adjustmentHkd).toBe(0);
    expect(preview.needsManagerApproval).toBe(false);
  });

  it("writes a CSV with only the sellers actually being paid", () => {
    const preview = buildPayoutPreview(
      [
        { user_id: "u1", amount_hkd: 60 },
        { user_id: "u3", amount_hkd: 10 },
      ],
      sellers,
      details,
    );
    const csv = payoutPreviewCsv(preview);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("seller,tutor_code,method,payee,balance_hkd,due_hkd");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('"Alice","MM-T001","fps_phone","Alice Chan",60.00,60.00');
  });
});
