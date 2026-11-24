import { describe, expect, it } from "vitest";

import {
  buildImportOps,
  normalizePhone,
  type ImportLookup,
} from "../../src/features/cases/import-plan";
import { parseCaseImportCsv } from "../../src/features/cases/import-csv";
import {
  claimFeePaid,
  feeMarkPaidRefusal,
  feeWaiveRefusal,
  legacyFeeMirrorPatch,
} from "../../src/features/cases/admin-desk.functions";
import type { Db } from "../../src/features/materials/storage-helpers";

const tutors: {
  id: string;
  user_id: string | null;
  display_name: string;
  tutor_code: string | null;
}[] = [
  { id: "t1", user_id: "u1", display_name: "Kitty Chan", tutor_code: "MM-T005" },
  { id: "t2", user_id: null, display_name: "Marcus Wong", tutor_code: "MM-T012" },
];

const lookup: ImportLookup = {
  findTutor: (needle) => {
    const n = needle.trim().toLowerCase();
    return (
      tutors.find((t) => (t.tutor_code ?? "").toLowerCase() === n) ??
      tutors.find((t) => t.display_name.toLowerCase() === n) ??
      null
    );
  },
  findParentByPhone: (phone) => (normalizePhone(phone) === "91234567" ? { id: "p1" } : null),
};

describe("import planning (#201)", () => {
  it("normalizes phones to digits and strips the 852 country code", () => {
    expect(normalizePhone("+852 9123 4567")).toBe("91234567");
    expect(normalizePhone("9123-4567")).toBe("91234567");
    expect(normalizePhone("85231234")).toBe("85231234"); // 8 digits stays intact
  });

  it("resolves tutor by code case-insensitively and parent by phone", () => {
    const csv = [
      "parent name,phone,tutor,subject,rate,lesson dates,fee paid",
      "Mrs. Chan,+852 9123 4567,mm-t005,Physics,500,2026-10-01;2026-10-08,yes",
    ].join("\n");
    const res = buildImportOps(parseCaseImportCsv(csv).rows, lookup);
    expect(res.errors).toEqual([]);
    expect(res.ops).toHaveLength(1);
    const op = res.ops[0];
    expect(op.tutorId).toBe("t1");
    expect(op.parentAccountId).toBe("p1");
    expect(op.lessonDateKeys).toEqual(["2026-10-01", "2026-10-08"]); // date order
    expect(op.feePaid).toBe(true);
    expect(op.hourlyRateHkd).toBe(500);
  });

  it("falls back to exact display-name tutor match", () => {
    const csv = [
      "parent name,phone,tutor,subject,rate,lesson dates,fee paid",
      "Mr. Lee,91234567,Marcus Wong,IB Math,650,2026/10/02,no",
    ].join("\n");
    const res = buildImportOps(parseCaseImportCsv(csv).rows, lookup);
    expect(res.errors).toEqual([]);
    expect(res.ops[0].tutorId).toBe("t2");
    expect(res.ops[0].parentAccountId).toBe("p1"); // 91234567 matches the seeded parent
  });

  it("unresolvable tutor -> row error, never a guess", () => {
    const csv = [
      "parent name,phone,tutor,subject,rate,lesson dates,fee paid",
      "X,9,Y,Math,300,2026-10-01,yes",
    ].join("\n");
    const res = buildImportOps(parseCaseImportCsv(csv).rows, lookup);
    expect(res.ops).toHaveLength(0);
    expect(res.errors).toEqual([{ row: 1, message: 'tutor "Y" not found' }]);
  });

  it("sorts lesson dates chronologically regardless of CSV order", () => {
    const csv = [
      "parent name,phone,tutor,subject,rate,lesson dates,fee paid",
      "A,9,MM-T005,Math,300,2026-10-08;2026-10-01,yes",
    ].join("\n");
    const res = buildImportOps(parseCaseImportCsv(csv).rows, lookup);
    expect(res.ops[0].lessonDateKeys).toEqual(["2026-10-01", "2026-10-08"]);
  });
});

// ---------------------------------------------------------------------------
// #816 §2.2 residual: the fee pay / waive guards. The handlers themselves need
// the service-role client + auth middleware, so the predicates and the claim
// helper are exercised directly; the DB-side effect ordering is asserted by
// the call log of a fake builder (no query runs before the status predicate).
// ---------------------------------------------------------------------------

type FeeClaimResult = { error: { message: string } | null; count: number | null };

function fakeFeeDb(result: FeeClaimResult) {
  const calls: string[] = [];
  const chain = {
    eq(col: string, value: unknown) {
      calls.push(`eq:${col}=${String(value)}`);
      return chain;
    },
    then(onFulfilled: (value: FeeClaimResult) => unknown) {
      return Promise.resolve(result).then(onFulfilled);
    },
  };
  const db = {
    from(table: string) {
      return {
        update(patch: Record<string, unknown>, opts?: { count?: string }) {
          calls.push(`update:${table}:${JSON.stringify(patch)}:${opts?.count ?? "no-count"}`);
          return chain;
        },
      };
    },
  };
  return { db: db as unknown as Db, calls };
}

describe("fee pay / waive guards (#816 §2.2)", () => {
  it("refuses to re-mark a waived fee or a paid fee as paid", () => {
    expect(feeMarkPaidRefusal({ status: "invoiced", waive_reason: null })).toBeNull();
    // already waived: the reason is still on the row
    expect(feeMarkPaidRefusal({ status: "waived", waive_reason: "goodwill" })).toBe(
      "FEE_NOT_INVOICED",
    );
    // status drifted back but the waive reason survives — still refused
    expect(feeMarkPaidRefusal({ status: "invoiced", waive_reason: "goodwill" })).toBe(
      "FEE_NOT_INVOICED",
    );
    // already paid: a second mark would rewrite paid_at and re-fire the receipt
    expect(feeMarkPaidRefusal({ status: "paid", waive_reason: null })).toBe("FEE_NOT_INVOICED");
    expect(feeMarkPaidRefusal({ status: "refunded", waive_reason: null })).toBe("FEE_NOT_INVOICED");
    expect(feeMarkPaidRefusal({ status: "not_due", waive_reason: null })).toBe("FEE_NOT_INVOICED");
    expect(feeMarkPaidRefusal(null)).toBe("FEE_NOT_FOUND");
  });

  it("refuses to waive a fee that already holds money", () => {
    expect(feeWaiveRefusal({ status: "invoiced" })).toBeNull();
    expect(feeWaiveRefusal({ status: "paid" })).toBe("FEE_ALREADY_PAID");
    expect(feeWaiveRefusal({ status: "refunded" })).toBe("FEE_ALREADY_PAID");
    expect(feeWaiveRefusal({ status: "waived" })).toBe("FEE_NOT_INVOICED");
    expect(feeWaiveRefusal(null)).toBe("FEE_NOT_FOUND");
  });

  it("claims only an invoiced row and reports 0 affected rows as not paid", async () => {
    const miss = fakeFeeDb({ error: null, count: 0 });
    const claimed = await claimFeePaid({
      db: miss.db,
      feeId: "f1",
      patch: { status: "paid" },
    });
    // false means the handler throws FEE_NOT_INVOICED before any side effect
    expect(claimed).toBe(false);
    expect(miss.calls).toEqual([
      'update:case_fees:{"status":"paid"}:exact',
      "eq:id=f1",
      "eq:status=invoiced",
    ]);

    const hit = fakeFeeDb({ error: null, count: 1 });
    expect(await claimFeePaid({ db: hit.db, feeId: "f1", patch: { status: "paid" } })).toBe(true);
  });

  it("surfaces the FPS trigger code instead of the raw database message", async () => {
    const dup = fakeFeeDb({
      error: { message: "FPS_REFERENCE_USED: reference taken" },
      count: null,
    });
    await expect(claimFeePaid({ db: dup.db, feeId: "f1", patch: {} })).rejects.toThrow(
      "FPS_REFERENCE_USED",
    );
  });

  it("mirrors the summed paid total once, identically for both pay paths", () => {
    const now = "2026-11-24T10:00:00.000Z";
    // feeMarkPaid: one fee paid
    const single = legacyFeeMirrorPatch({
      existingCollectedAt: null,
      paidAmountsHkd: [750],
      nowIso: now,
    });
    // transitionCase: both tranches marked paid in one request
    const summed = legacyFeeMirrorPatch({
      existingCollectedAt: null,
      paidAmountsHkd: ["500", 250],
      nowIso: now,
    });
    expect(single).toEqual({ fee_collected_at: now, fee_amount_cents: 75000 });
    expect(summed).toEqual(single);
  });

  it("never moves an existing mirror and never invents one from nothing", () => {
    expect(
      legacyFeeMirrorPatch({
        existingCollectedAt: "2026-01-01T00:00:00.000Z",
        paidAmountsHkd: [750],
        nowIso: "2026-11-24T10:00:00.000Z",
      }),
    ).toBeNull();
    expect(
      legacyFeeMirrorPatch({
        existingCollectedAt: null,
        paidAmountsHkd: [0, null, undefined, "nope"],
        nowIso: "2026-11-24T10:00:00.000Z",
      }),
    ).toBeNull();
  });
});
