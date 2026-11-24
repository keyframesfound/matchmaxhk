import { describe, expect, it } from "vitest";

import {
  NOTE_REVIEW_WEEKLY_CAP,
  assertNoteReviewCap,
} from "../../src/features/materials/note-engagement.functions";

/**
 * #702 anti-manipulation: note ratings are capped per buyer per rolling week.
 * The cap only bites on a NEW (material, buyer) row — the upsert edits the one
 * existing review in place, so re-rating the same note never spends the budget.
 *
 * Only the pure cap helper is exercised here; the server fn around it is
 * middleware + access-check glue that RLS already covers.
 */

type Row = Record<string, unknown>;

function fakeDb(reviews: Row[]) {
  type Ctx = { filters: ((r: Row) => boolean)[] };

  function resolve(ctx: Ctx): Row[] {
    return reviews.filter((r) => ctx.filters.every((f) => f(r)));
  }

  function builder(ctx: Ctx): unknown {
    return {
      eq: (col: string, value: unknown) =>
        builder({ filters: [...ctx.filters, (r) => r[col] === value] }),
      gte: (col: string, value: string) =>
        builder({ filters: [...ctx.filters, (r) => String(r[col] ?? "") >= value] }),
      maybeSingle: async () => ({ data: resolve(ctx)[0] ?? null, error: null }),
      then: (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve({ data: resolve(ctx), error: null }).then(onFulfilled, onRejected),
    };
  }

  return {
    from: <T>(_table: string) => ({
      select: (_cols: string) => builder({ filters: [] }),
    }),
  } as never;
}

const NOW = new Date("2026-11-24T10:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const review = (id: string, materialId: string, createdAt: string): Row => ({
  id,
  material_id: materialId,
  buyer_account_id: "buyer-1",
  rating: 5,
  created_at: createdAt,
});

describe("#702 note review weekly cap", () => {
  it("refuses the 6th new note rating inside 7 days", async () => {
    const db = fakeDb([
      review("r1", "m1", daysAgo(6)),
      review("r2", "m2", daysAgo(5)),
      review("r3", "m3", daysAgo(3)),
      review("r4", "m4", daysAgo(2)),
      review("r5", "m5", daysAgo(1)),
    ]);

    expect(NOTE_REVIEW_WEEKLY_CAP).toBe(5);
    await expect(assertNoteReviewCap(db, "buyer-1", "m6", NOW)).rejects.toThrow("RATE_LIMITED");
  });

  it("allows re-saving an existing review even at the cap", async () => {
    const db = fakeDb([
      review("r1", "m1", daysAgo(6)),
      review("r2", "m2", daysAgo(5)),
      review("r3", "m3", daysAgo(3)),
      review("r4", "m4", daysAgo(2)),
      review("r5", "m5", daysAgo(1)),
      review("mine", "m1", daysAgo(4)),
    ]);

    await expect(assertNoteReviewCap(db, "buyer-1", "m1", NOW)).resolves.toBeUndefined();
  });

  it("allows a fifth new rating and ignores rows past the window", async () => {
    const db = fakeDb([
      review("old1", "m0", daysAgo(20)),
      review("old2", "m0b", daysAgo(9)),
      review("r1", "m1", daysAgo(6)),
      review("r2", "m2", daysAgo(5)),
      review("r3", "m3", daysAgo(3)),
    ]);

    await expect(assertNoteReviewCap(db, "buyer-1", "m6", NOW)).resolves.toBeUndefined();
  });
});
