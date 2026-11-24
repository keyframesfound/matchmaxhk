import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/ops-webhook.server", () => ({ notifyOps: vi.fn() }));

import {
  RATING_BURST_FIVE_STAR,
  RATING_BURST_MIN_LESSONS,
  RATING_WEEKLY_CAP,
  saveCaseRatingCore,
} from "../../src/features/cases/rating-core.server";
import { notifyOps } from "../../src/lib/ops-webhook.server";

/**
 * #702 anti-manipulation guards on lesson ratings.
 *
 * These drive saveCaseRatingCore against a fake service-role client that
 * supports the exact chain shapes the core uses (select/eq/in/gte/order/limit,
 * insert().select().single(), update().eq()). RLD is on and service-role-only
 * in production, so this is the only layer that can be exercised in vitest.
 */

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

function fakeDb(tables: Tables) {
  const inserted: Row[] = [];
  const updated: Row[] = [];

  function rowsOf(table: string): Row[] {
    return (tables[table] ??= []);
  }

  type Ctx = {
    filters: ((r: Row) => boolean)[];
    order?: { col: string; ascending: boolean };
    limit?: number;
  };

  function resolveRows(ctx: Ctx): Row[] {
    let out = rowsOf(ctx.table).filter((r) => ctx.filters.every((f) => f(r)));
    const { order, limit } = ctx;
    if (order) {
      out = [...out].sort((a, b) => {
        const av = String(a[order.col] ?? "");
        const bv = String(b[order.col] ?? "");
        if (av === bv) return 0;
        return (av < bv ? -1 : 1) * (order.ascending ? 1 : -1);
      });
    }
    return limit != null ? out.slice(0, limit) : out;
  }

  function builder(ctx: Ctx): unknown {
    const chain = {
      eq: (col: string, value: unknown) =>
        builder({ ...ctx, filters: [...ctx.filters, (r) => r[col] === value] }),
      in: (col: string, values: unknown[]) =>
        builder({ ...ctx, filters: [...ctx.filters, (r) => values.includes(r[col])] }),
      gte: (col: string, value: string) =>
        builder({ ...ctx, filters: [...ctx.filters, (r) => String(r[col] ?? "") >= value] }),
      order: (col: string, opts?: { ascending?: boolean }) =>
        builder({ ...ctx, order: { col, ascending: opts?.ascending !== false } }),
      limit: (n: number) => builder({ ...ctx, limit: n }),
      maybeSingle: async () => ({ data: resolveRows(ctx)[0] ?? null, error: null }),
      single: async () => {
        const data = resolveRows(ctx)[0] ?? null;
        return { data, error: data ? null : { message: "no row" } };
      },
      then: (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve({ data: resolveRows(ctx), error: null }).then(onFulfilled, onRejected),
    };
    return chain;
  }

  const db = {
    from: <T>(table: string) => ({
      select: (_cols: string) =>
        builder({ table, filters: [] } as unknown as Ctx & { table: string }),
      insert: (row: Row) => {
        const withId = { id: `new-${inserted.length + 1}`, ...row };
        inserted.push(withId);
        rowsOf(table).push(withId);
        return {
          select: (_cols: string) => ({
            single: async () => ({ data: withId as T, error: null }),
          }),
        };
      },
      update: (patch: Row) => {
        const apply = (ctx: { filters: ((r: Row) => boolean)[] }) => {
          for (const row of rowsOf(table)) {
            if (ctx.filters.every((f) => f(row))) {
              Object.assign(row, patch);
              updated.push({ ...row });
            }
          }
          return { error: null };
        };
        const chain = (filters: ((r: Row) => boolean)[]): unknown => ({
          eq: (col: string, value: unknown) => chain([...filters, (r) => r[col] === value]),
          then: (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
            Promise.resolve(apply({ filters })).then(onFulfilled, onRejected),
        });
        return chain([]);
      },
    }),
  };

  return { db: db as never, inserted, updated };
}

const NOW = new Date("2026-11-24T10:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const KASE = {
  sor_status: null,
  student_level: "G11",
  student_grade_current: "G11",
  exam_system: "IB",
  subjects: ["Physics"],
  ended_by_parent_at: null,
  ended_by_tutor_at: null,
  updated_at: "2026-11-01T00:00:00.000Z",
};

function baseTables(overrides: Tables = {}): Tables {
  return {
    profiles: [
      { id: "p1", email: "parent1@example.com", phone: null },
      { id: "tutor-user", email: "tutor@example.com", phone: null },
    ],
    tutors: [{ id: "t1", user_id: "tutor-user" }],
    tutoring_cases: [
      ...["c1", "c2", "c3", "c4"].map((id) => ({
        id,
        parent_id: "p1",
        matched_tutor_id: "t1",
        ...KASE,
      })),
    ],
    case_lessons: ["c1", "c2", "c3", "c4"].map((case_id, i) => ({
      id: `l${i + 1}`,
      case_id,
      status: "done",
      confirmed_by_parent_at: null,
      confirmed_by_tutor_at: null,
    })),
    case_reviews: [],
    ...overrides,
  };
}

function recentReview(id: string, caseId: string, createdAt: string): Row {
  return {
    id,
    case_id: caseId,
    direction: "parent_to_tutor",
    author_account_id: "p1",
    tutor_id: "t1",
    status: "visible",
    rating: 5,
    comment: "Great lesson",
    held_reason: null,
    desk_note: null,
    desk_note_at: null,
    created_at: createdAt,
    updated_at: createdAt,
    completed_lessons_at_write: 1,
    author_display_line: "Parent of G11 IB Physics",
  };
}

const input = (caseId: string, rating = 5) => ({
  caseId,
  direction: "parent_to_tutor" as const,
  rating,
  comment: "",
  deskNote: "",
});

beforeEach(() => {
  vi.mocked(notifyOps).mockClear();
  vi.mocked(notifyOps).mockResolvedValue(undefined);
});

describe("#702 weekly rate cap", () => {
  it("blocks the 4th new rating inside 7 days with RATE_LIMITED", async () => {
    const { db } = fakeDb(
      baseTables({
        case_reviews: [
          recentReview("r1", "c1", daysAgo(6)),
          recentReview("r2", "c2", daysAgo(4)),
          recentReview("r3", "c3", daysAgo(2)),
        ],
      }),
    );

    expect(RATING_WEEKLY_CAP).toBe(3);
    await expect(saveCaseRatingCore(db, "p1", input("c4"), NOW)).rejects.toThrow("RATE_LIMITED");
  });

  it("allows re-editing the existing row for a case+direction at the cap", async () => {
    const { db, inserted, updated } = fakeDb(
      baseTables({
        case_reviews: [
          recentReview("r1", "c1", daysAgo(6)),
          recentReview("r2", "c2", daysAgo(4)),
          recentReview("r3", "c3", daysAgo(2)),
        ],
      }),
    );

    const result = await saveCaseRatingCore(db, "p1", input("c1", 4), NOW);

    expect(result.status).toBe("visible");
    expect(inserted).toHaveLength(0);
    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({ id: "r1", rating: 4 });
  });

  it("ignores rows older than the window when counting", async () => {
    const { db, inserted } = fakeDb(
      baseTables({
        case_reviews: [
          recentReview("r1", "c1", daysAgo(9)),
          recentReview("r2", "c2", daysAgo(8)),
          recentReview("r3", "c3", daysAgo(8)),
        ],
      }),
    );

    await saveCaseRatingCore(db, "p1", input("c4", 4), NOW);
    expect(inserted).toHaveLength(1);
  });
});

describe("#702 self-dealing collision hold", () => {
  it("holds on a normalised phone match and keeps the row out of the aggregate", async () => {
    const tables = baseTables({
      profiles: [
        { id: "p1", email: "parent1@example.com", phone: "+852 9123 4567" },
        { id: "tutor-user", email: "tutor@example.com", phone: "9123-4567" },
      ],
    });
    const { db, inserted } = fakeDb(tables);

    const result = await saveCaseRatingCore(db, "p1", input("c1"), NOW);

    expect(result.status).toBe("held");
    expect(result.heldReason).toBe("self_deal: phone");
    expect(inserted[0]).toMatchObject({ status: "held", held_reason: "self_deal: phone" });
    // The public aggregate RPC counts status = 'visible' only.
    const visible = (tables.case_reviews ?? []).filter((r) => r.status === "visible");
    expect(visible).toHaveLength(0);
  });

  it("holds on an email match regardless of case and surrounding spaces", async () => {
    const tables = baseTables({
      profiles: [
        { id: "p1", email: "Pat@Example.com", phone: null },
        { id: "tutor-user", email: "  pat@example.COM ", phone: null },
      ],
    });
    const { db } = fakeDb(tables);

    const result = await saveCaseRatingCore(db, "p1", input("c1"), NOW);

    expect(result.status).toBe("held");
    expect(result.heldReason).toBe("self_deal: email");
  });

  it("holds when the parent account is the tutor's own linked account", async () => {
    const tables = baseTables({
      profiles: [{ id: "p1", email: "parent1@example.com", phone: null }],
      tutors: [{ id: "t1", user_id: "p1" }],
    });
    const { db } = fakeDb(tables);

    const result = await saveCaseRatingCore(db, "p1", input("c1"), NOW);

    expect(result.status).toBe("held");
    expect(result.heldReason).toBe("self_deal: account");
  });

  it("still publishes when the profiles share nothing", async () => {
    const { db } = fakeDb(baseTables());
    const result = await saveCaseRatingCore(db, "p1", input("c1", 4), NOW);
    expect(result.status).toBe("visible");
    expect(result.heldReason).toBeNull();
  });
});

describe("#702 burst flag", () => {
  function burstTables(tutorCaseIds: string[]): Tables {
    return baseTables({
      case_reviews: [recentReview("r1", "c2", daysAgo(5)), recentReview("r2", "c3", daysAgo(1))],
      // Only the listed tutor cases carry a completed lesson.
      case_lessons: tutorCaseIds.map((case_id, i) => ({
        id: `lesson-${i + 1}`,
        case_id,
        status: "done",
        confirmed_by_parent_at: null,
        confirmed_by_tutor_at: null,
      })),
    });
  }

  it("holds the third five-star when the tutor has under 3 completed lessons", async () => {
    const tables = burstTables(["c1"]);
    const { db, inserted } = fakeDb(tables);

    const result = await saveCaseRatingCore(db, "p1", input("c1"), NOW);

    expect(RATING_BURST_FIVE_STAR).toBe(3);
    expect(RATING_BURST_MIN_LESSONS).toBe(3);
    expect(result.status).toBe("held");
    expect(result.heldReason).toBe("burst: five_star_reviews");
    expect(inserted[0]).toMatchObject({
      status: "held",
      held_reason: "burst: five_star_reviews",
    });
    // The two pre-seeded rows stay visible; only THIS case's rating is held.
    expect(
      (tables.case_reviews ?? []).filter((r) => r.case_id === "c1" && r.status === "visible"),
    ).toHaveLength(0);
    expect(notifyOps).toHaveBeenCalledWith(
      "case.rating_burst_hold",
      expect.objectContaining({
        case_id: "c1",
        tutor_id: "t1",
        rating: 5,
        recent_five_star: 3,
        tutor_completed_lessons: 1,
      }),
    );
  });

  it("publishes once the tutor has 3 completed lessons", async () => {
    const { db } = fakeDb(burstTables(["c1", "c2", "c3"]));
    const result = await saveCaseRatingCore(db, "p1", input("c1"), NOW);
    expect(result.status).toBe("visible");
    expect(notifyOps).not.toHaveBeenCalled();
  });

  it("does not burst a 4-star", async () => {
    const { db } = fakeDb(burstTables(["c1"]));
    const result = await saveCaseRatingCore(db, "p1", input("c1", 4), NOW);
    expect(result.status).toBe("visible");
    expect(notifyOps).not.toHaveBeenCalled();
  });
});
