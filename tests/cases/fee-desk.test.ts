import { describe, expect, it } from "vitest";

import {
  adminFeeOverdue,
  expectedMarkingDateHkt,
  fpsMemoForCase,
  isAllowedScreenshot,
  isReferenceUsedElsewhere,
  normalizeFpsReference,
  settlementCardState,
} from "../../src/features/cases/fee-desk";
import {
  applyFeeGate,
  disputeCarveOutReason,
  type OpenDispute,
} from "../../src/features/cases/fee-desk.functions";

describe("fee desk (#259)", () => {
  it("builds the FPS memo from the case code", () => {
    expect(fpsMemoForCase("c-1234")).toBe("MM-C-1234");
    expect(fpsMemoForCase("MM-C-1")).toBe("MM-C-1");
  });

  it("normalizes references so MM- prefix and spacing do not matter", () => {
    expect(normalizeFpsReference(" mm-c 12 ")).toBe("C12");
    expect(normalizeFpsReference("C12")).toBe("C12");
    expect(normalizeFpsReference("ab")).toBeNull();
    expect(normalizeFpsReference(null)).toBeNull();
  });

  it("rejects a reference that already closed another case", () => {
    const paid = [{ caseId: "a", fpsReference: "MM-C-100" }];
    expect(isReferenceUsedElsewhere("c-100", "b", paid)).toBe(true);
    expect(isReferenceUsedElsewhere("c-100", "a", paid)).toBe(false);
    expect(isReferenceUsedElsewhere("C-101", "b", paid)).toBe(false);
    expect(isReferenceUsedElsewhere("", "b", paid)).toBe(false);
  });

  it("accepts JPEG/PNG up to 10 MB only (#760)", () => {
    expect(isAllowedScreenshot("image/png", 1000)).toBe(true);
    expect(isAllowedScreenshot("image/jpeg", 10 * 1024 * 1024)).toBe(true);
    expect(isAllowedScreenshot("image/jpeg", 10 * 1024 * 1024 + 1)).toBe(false);
    expect(isAllowedScreenshot("image/webp", 1000)).toBe(false);
    expect(isAllowedScreenshot("image/png", 0)).toBe(false);
  });

  it("marks same working day before 18:00 HKT", () => {
    // Mon 2026-11-02 10:00 HKT = 02:00 UTC
    expect(expectedMarkingDateHkt(new Date("2026-11-02T02:00:00Z"))).toBe("2026-11-02");
  });

  it("rolls a screenshot after 18:00 HKT to the next working day", () => {
    // Mon 2026-11-02 19:00 HKT
    expect(expectedMarkingDateHkt(new Date("2026-11-02T11:00:00Z"))).toBe("2026-11-03");
    // Fri 2026-11-06 20:00 HKT → Mon 2026-11-09
    expect(expectedMarkingDateHkt(new Date("2026-11-06T12:00:00Z"))).toBe("2026-11-09");
  });

  it("rolls weekend screenshots to Monday", () => {
    // Sat 2026-11-07 09:00 HKT
    expect(expectedMarkingDateHkt(new Date("2026-11-07T01:00:00Z"))).toBe("2026-11-09");
  });
});

describe("#760 Part 3 — settlement card states", () => {
  it("maps the fee row onto the card states", () => {
    expect(settlementCardState({ status: "paid", proof_status: null })).toBe("settled");
    expect(settlementCardState({ status: "invoiced", proof_status: "none" })).toBe("payment_due");
    expect(settlementCardState({ status: "invoiced", proof_status: "submitted" })).toBe(
      "pending_verification",
    );
    expect(settlementCardState({ status: "invoiced", proof_status: "rejected" })).toBe("rejected");
    expect(settlementCardState({ status: "waived", proof_status: null })).toBeNull();
    expect(settlementCardState({ status: "not_due", proof_status: null })).toBeNull();
  });

  it("keeps the 10 MB screenshot acceptance (#760)", () => {
    expect(isAllowedScreenshot("image/png", 10 * 1024 * 1024)).toBe(true);
    expect(isAllowedScreenshot("image/png", 10 * 1024 * 1024 + 1)).toBe(false);
  });
});

describe("#760 Part 3 — 72h overdue soft gate", () => {
  const now = new Date("2026-11-12T10:00:00Z");
  const base = {
    payment_screenshot_path: null,
    proof_status: "none",
    proof_rejected_at: null,
    created_at: "2026-11-08T00:00:00Z",
  };

  it("flags an invoiced fee unresolved past 72h", () => {
    // created 2026-11-08, now 11-12 → 4 days open
    expect(adminFeeOverdue({ status: "invoiced", ...base }, now)).toBe(true);
  });

  it("never flags fresh fees, paid rows, or accepted proofs", () => {
    expect(
      adminFeeOverdue({ status: "invoiced", ...base, created_at: "2026-11-11T00:00:00Z" }, now),
    ).toBe(false);
    expect(adminFeeOverdue({ status: "paid", ...base }, now)).toBe(false);
    expect(adminFeeOverdue({ status: "waived", ...base }, now)).toBe(false);
    expect(adminFeeOverdue({ status: "invoiced", ...base, proof_status: "submitted" }, now)).toBe(
      false,
    );
  });

  it("a rejected proof resets the clock by +24h, then overdue again", () => {
    const rejected = {
      status: "invoiced",
      ...base,
      proof_status: "rejected",
      proof_rejected_at: "2026-11-11T18:00:00Z",
    };
    // 16h after rejection → inside the +24h window
    expect(adminFeeOverdue(rejected, new Date("2026-11-12T10:00:00Z"))).toBe(false);
    // 30h after rejection → overdue again (fee now ~4.5 days open)
    expect(adminFeeOverdue(rejected, new Date("2026-11-13T00:00:00Z"))).toBe(true);
  });

  it("junk timestamps never block", () => {
    expect(adminFeeOverdue({ status: "invoiced", ...base, created_at: null }, now)).toBe(false);
  });
});

describe("#756 [was #260] — open-dispute carve-out on the 72h gate", () => {
  const now = new Date("2026-11-12T10:00:00Z");
  // Invoiced 4 days ago, no proof: past the 72h window.
  const overdueFee = {
    status: "invoiced",
    payment_screenshot_path: null,
    proof_status: "none",
    proof_rejected_at: null,
    created_at: "2026-11-08T00:00:00Z",
  };
  const noDispute: OpenDispute[] = [
    { source: "tutor_session_logs", count: 0 },
    { source: "verified_hours_ledger", count: 0 },
  ];
  const openDispute: OpenDispute[] = [
    { source: "tutor_session_logs", count: 1 },
    { source: "verified_hours_ledger", count: 0 },
  ];

  it("(a) unpaid fee + no dispute → still blocks, exactly as before", () => {
    const gate = applyFeeGate({ fees: [overdueFee], disputes: noDispute, now });
    expect(gate.blocks).toBe(true);
    expect(gate.carveOut).toBeNull();
    // Byte-for-byte: the gate agrees with the pre-existing pure rule.
    expect(gate.overdue).toBe(adminFeeOverdue(overdueFee, now));
    expect(gate.blocks).toBe(adminFeeOverdue(overdueFee, now));
  });

  it("(b) unpaid fee + open dispute → not blocked, bypass reason recorded", () => {
    const gate = applyFeeGate({ fees: [overdueFee], disputes: openDispute, now });
    expect(gate.blocks).toBe(false);
    expect(gate.overdue).toBe(true);
    expect(gate.carveOut).toBe("open_dispute");
    expect(disputeCarveOutReason(gate.disputes)).toContain("open dispute");
    expect(disputeCarveOutReason(gate.disputes)).toContain("tutor_session_logs=1");
  });

  it("(b2) an open hours-ledger dispute also lifts the block", () => {
    const gate = applyFeeGate({
      fees: [overdueFee],
      disputes: [
        { source: "tutor_session_logs", count: 0 },
        { source: "verified_hours_ledger", count: 2 },
      ],
      now,
    });
    expect(gate.blocks).toBe(false);
    expect(disputeCarveOutReason(gate.disputes)).toContain("verified_hours_ledger=2");
  });

  it("(c) a paid fee never blocks, dispute or not", () => {
    const paid = { ...overdueFee, status: "paid" };
    expect(applyFeeGate({ fees: [paid], disputes: noDispute, now }).blocks).toBe(false);
    expect(applyFeeGate({ fees: [paid], disputes: openDispute, now }).blocks).toBe(false);
    expect(applyFeeGate({ fees: [paid], disputes: noDispute, now }).carveOut).toBeNull();
  });

  it("a fresh fee is not blocked and records no carve-out", () => {
    const fresh = { ...overdueFee, created_at: "2026-11-11T00:00:00Z" };
    const gate = applyFeeGate({ fees: [fresh], disputes: openDispute, now });
    expect(gate.blocks).toBe(false);
    expect(gate.overdue).toBe(false);
    expect(gate.carveOut).toBeNull();
  });

  it("an empty fee list is never blocked", () => {
    expect(applyFeeGate({ fees: [], disputes: noDispute, now }).blocks).toBe(false);
  });
});
