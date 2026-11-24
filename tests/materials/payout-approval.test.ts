import { describe, expect, it } from "vitest";

import { resolvePayoutApproval } from "../../src/features/materials/payout-batch.functions";

const CALLER = "11111111-1111-4111-8111-111111111111";
const OTHER_ADMIN = "22222222-2222-4222-8222-222222222222";
const TUTOR = "33333333-3333-4333-8333-333333333333";

describe("#784 money-safety: second-person payout approval", () => {
  it("rejects the caller approving their own HK$500+ batch", () => {
    expect(
      resolvePayoutApproval({
        callerId: CALLER,
        approverId: CALLER,
        needsApproval: true,
        approverRoles: ["admin"],
      }),
    ).toEqual({ ok: false, code: "SELF_APPROVAL_FORBIDDEN" });
  });

  it("requires an approver when the batch needs sign-off", () => {
    for (const approverId of [undefined, null, "", "   "]) {
      expect(
        resolvePayoutApproval({
          callerId: CALLER,
          approverId,
          needsApproval: true,
          approverRoles: [],
        }),
      ).toEqual({ ok: false, code: "APPROVER_REQUIRED" });
    }
  });

  it("rejects an approver who does not hold an admin role", () => {
    expect(
      resolvePayoutApproval({
        callerId: CALLER,
        approverId: TUTOR,
        needsApproval: true,
        approverRoles: ["tutor"],
      }),
    ).toEqual({ ok: false, code: "APPROVER_NOT_ADMIN" });
    expect(
      resolvePayoutApproval({
        callerId: CALLER,
        approverId: TUTOR,
        needsApproval: true,
        approverRoles: [],
      }),
    ).toEqual({ ok: false, code: "APPROVER_NOT_ADMIN" });
  });

  it("accepts a second admin, and super_admin counts as admin", () => {
    expect(
      resolvePayoutApproval({
        callerId: CALLER,
        approverId: OTHER_ADMIN,
        needsApproval: true,
        approverRoles: ["admin"],
      }),
    ).toEqual({ ok: true, approvedBy: OTHER_ADMIN });
    expect(
      resolvePayoutApproval({
        callerId: CALLER,
        approverId: OTHER_ADMIN,
        needsApproval: true,
        approverRoles: ["super_admin"],
      }),
    ).toEqual({ ok: true, approvedBy: OTHER_ADMIN });
  });

  it("keeps the caller as approver below the HK$500 threshold", () => {
    expect(
      resolvePayoutApproval({
        callerId: CALLER,
        approverId: undefined,
        needsApproval: false,
        approverRoles: [],
      }),
    ).toEqual({ ok: true, approvedBy: CALLER });
    // A stale approverId on a below-threshold run is not a claim to honour.
    expect(
      resolvePayoutApproval({
        callerId: CALLER,
        approverId: OTHER_ADMIN,
        needsApproval: false,
        approverRoles: [],
      }),
    ).toEqual({ ok: true, approvedBy: CALLER });
  });

  it("passes through exactly the approved id, never the caller", () => {
    const approval = resolvePayoutApproval({
      callerId: CALLER,
      approverId: ` ${OTHER_ADMIN} `,
      needsApproval: true,
      approverRoles: ["admin"],
    });
    expect(approval.ok).toBe(true);
    if (!approval.ok) throw new Error("expected an approval");
    expect(approval.approvedBy).toBe(OTHER_ADMIN);
    expect(approval.approvedBy).not.toBe(CALLER);
  });
});
