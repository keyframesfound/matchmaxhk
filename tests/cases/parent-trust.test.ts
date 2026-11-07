import { describe, expect, it } from "vitest";

import {
  computeParentTrust,
  parentTrustByCase,
  statementDueAt,
  type TrustDb,
} from "../../src/features/cases/parent-trust";

const onTime = { paidAt: "2026-10-02T00:00:00.000Z", dueAt: "2026-10-08T00:00:00.000Z" };
const late = { paidAt: "2026-10-20T00:00:00.000Z", dueAt: "2026-10-08T00:00:00.000Z" };

describe("computeParentTrust", () => {
  it("shows nothing below the threshold, so one review can't single a parent out", () => {
    expect(computeParentTrust([5, 5], [onTime, onTime])).toBeNull();
  });

  it("rounds the rating to one decimal once it has 3 samples", () => {
    expect(computeParentTrust([5, 5, 4], [])).toEqual({
      rating: 4.7,
      ratingCount: 3,
      onTime: false,
    });
  });

  it("needs 3 settled months, all on time", () => {
    expect(computeParentTrust([], [onTime, onTime, onTime])?.onTime).toBe(true);
    expect(computeParentTrust([], [onTime, onTime, late])).toBeNull();
    expect(computeParentTrust([5, 5, 5], [onTime, onTime, late])?.onTime).toBe(false);
  });

  it("ignores unsettled months", () => {
    expect(
      computeParentTrust([], [onTime, onTime, { paidAt: null, dueAt: onTime.dueAt }]),
    ).toBeNull();
  });
});

describe("statementDueAt", () => {
  it("is 7 days after the month ends, in HKT", () => {
    expect(statementDueAt("2026-10")).toBe("2026-11-07T16:00:00.000Z");
    expect(statementDueAt("2026-12")).toBe("2027-01-07T16:00:00.000Z");
  });
});

describe("parentTrustByCase", () => {
  function fakeDb(tables: Record<string, Record<string, unknown>[]>): TrustDb {
    return {
      from: (table) => ({
        select: () => {
          let rows = tables[table] ?? [];
          const query = {
            eq: (column: string, value: string) => {
              rows = rows.filter((r) => r[column] === value);
              return query;
            },
            in: (column: string, values: string[]) => {
              rows = rows.filter((r) => values.includes(r[column] as string));
              return query;
            },
            then: (resolve: (value: { data: unknown }) => unknown) => resolve({ data: rows }),
          };
          return query as never;
        },
      }),
    };
  }

  it("aggregates across a parent's other cases and skips tutor-unconfirmed months", async () => {
    const db = fakeDb({
      tutoring_cases: [
        { id: "open", parent_id: "p1" },
        { id: "old", parent_id: "p1" },
        { id: "guest", parent_id: null },
      ],
      case_reviews: [1, 2, 3].map((i) => ({
        case_id: "old",
        rating: 5,
        direction: "tutor_to_parent",
        status: i === 3 ? "visible" : "visible",
      })),
      case_statement_months: [
        {
          case_id: "old",
          month: "2026-09",
          marked_at: "2026-10-01T00:00:00.000Z",
          status: "paid",
          marked_by_role: "parent",
        },
      ],
    });
    const result = await parentTrustByCase(db, ["open", "guest"]);
    expect(result.get("open")).toEqual({ rating: 5, ratingCount: 3, onTime: false });
    expect(result.has("guest")).toBe(false);
  });

  it("does not count hidden reviews or the parent's own direction", async () => {
    const db = fakeDb({
      tutoring_cases: [{ id: "open", parent_id: "p1" }],
      case_reviews: [
        { case_id: "open", rating: 1, direction: "parent_to_tutor", status: "visible" },
        { case_id: "open", rating: 1, direction: "tutor_to_parent", status: "hidden" },
        { case_id: "open", rating: 1, direction: "tutor_to_parent", status: "visible" },
      ],
    });
    expect((await parentTrustByCase(db, ["open"])).size).toBe(0);
  });
});
