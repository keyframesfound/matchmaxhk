import { describe, expect, it } from "vitest";

import {
  applyNoteLikeToggle,
  countNoteLikes,
  countNoteLikesForMany,
  isSelfLike,
  planNoteLikeNotification,
  readNoteLikeState,
  NOTE_LIKE_BATCH_MAX,
} from "../../src/features/materials/note-likes.functions";
import { bellLabel, bellLabelKey } from "../../src/features/cases/bell-view";
import { planDeliveriesForEvent } from "../../src/features/cases/bus";

/**
 * #726 like half: one row per (note, account). Unlike deletes, duplicate likes
 * are no-ops, self-likes are refused, counts are per note, guests are tolerated
 * and only a NEW like on someone else's note plans a delivery.
 */

type LikeRow = { id: string; material_id: string; account_id: string };

/**
 * Minimal AdminDb double for material_likes. `uniqueRace` simulates losing the
 * unique (material_id, account_id) insert race: the concurrent row lands, this
 * call gets 23505 and must not treat itself as the creating call.
 */
function fakeDb(seed: LikeRow[] = [], opts: { uniqueRace?: boolean } = {}) {
  const rows: LikeRow[] = seed.map((r) => ({ ...r }));
  let nextId = rows.length + 1;
  type Filter = (row: LikeRow) => boolean;
  const matches = (filters: Filter[]) => (row: LikeRow) => filters.every((f) => f(row));
  const col = (row: LikeRow, key: string) => (row as Record<string, unknown>)[key];

  function selectChain(filters: Filter[]) {
    return {
      eq: (key: string, value: unknown) => selectChain([...filters, (r) => col(r, key) === value]),
      in: (key: string, values: unknown[]) =>
        selectChain([...filters, (r) => values.includes(col(r, key))]),
      maybeSingle: async () => ({ data: rows.find(matches(filters)) ?? null, error: null }),
      then: (onOk?: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) =>
        Promise.resolve({ data: rows.filter(matches(filters)), error: null }).then(onOk, onErr),
    };
  }

  function deleteChain(filters: Filter[]) {
    return {
      eq: (key: string, value: unknown) => deleteChain([...filters, (r) => col(r, key) === value]),
      then: (onOk?: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) => {
        const before = rows.length;
        for (let i = rows.length - 1; i >= 0; i -= 1) {
          if (matches(filters)(rows[i])) rows.splice(i, 1);
        }
        return Promise.resolve({ error: null, count: before - rows.length }).then(onOk, onErr);
      },
    };
  }

  return {
    rows,
    from: () => ({
      select: () => selectChain([]),
      insert: (row: unknown) => {
        const value = row as Omit<LikeRow, "id">;
        const present = rows.some(
          (r) => r.material_id === value.material_id && r.account_id === value.account_id,
        );
        if (present || opts.uniqueRace) {
          // The concurrent writer's row exists; this call is the loser.
          if (!present) rows.push({ id: `like-${nextId++}`, ...value });
          return Promise.resolve({
            data: null,
            error: { message: "duplicate key value violates unique constraint", code: "23505" },
          });
        }
        rows.push({ id: `like-${nextId++}`, ...value });
        return Promise.resolve({ data: null, error: null });
      },
      delete: () => deleteChain([]),
    }),
  };
}

const like = (id: string, materialId: string, accountId: string): LikeRow => ({
  id,
  material_id: materialId,
  account_id: accountId,
});

const t = (key: string, vars?: Record<string, unknown>) =>
  vars && Object.keys(vars).length > 0 ? `${key}:${JSON.stringify(vars)}` : key;

describe("#726 note likes", () => {
  it("removes the row on unlike and reports the reduced count", async () => {
    const db = fakeDb([like("l1", "m1", "a1"), like("l2", "m1", "a2")]);

    const result = await applyNoteLikeToggle(db as never, "m1", "a1", false);

    expect(result).toEqual({ liked: false, count: 1, changed: true });
    expect(db.rows.map((r) => r.account_id)).toEqual(["a2"]);
  });

  it("treats a duplicate like as a no-op (no second notification)", async () => {
    const db = fakeDb([like("l1", "m1", "a1")]);

    const result = await applyNoteLikeToggle(db as never, "m1", "a1", true);

    // changed:false is the notification gate — the same like never re-notifies.
    expect(result).toEqual({ liked: true, count: 1, changed: false });
    expect(db.rows).toHaveLength(1);
  });

  it("treats a lost unique race (23505) as a duplicate no-op", async () => {
    const db = fakeDb([], { uniqueRace: true });

    const result = await applyNoteLikeToggle(db as never, "m1", "a1", true);

    expect(result).toEqual({ liked: true, count: 1, changed: false });
  });

  it("refuses a self-like before any write", async () => {
    expect(isSelfLike("acc-1", "acc-1")).toBe(true);
    expect(isSelfLike("acc-1", "acc-2")).toBe(false);
    expect(isSelfLike("acc-1", null)).toBe(false);

    const planned = planNoteLikeNotification({
      liked: true,
      changed: true,
      viewerAccountId: "acc-1",
      ownerAccountId: "acc-1",
      materialId: "m1",
      label: "IB Phys IA",
      slug: "ib-phys-ia",
    });
    expect(planned).toBeNull();
  });

  it("counts only rows on the requested note", async () => {
    const db = fakeDb([like("l1", "m1", "a1"), like("l2", "m1", "a2"), like("l3", "m2", "a1")]);

    await expect(countNoteLikes(db as never, "m1")).resolves.toBe(2);
    await expect(countNoteLikes(db as never, "missing")).resolves.toBe(0);
  });

  it("returns guest state as liked:false with the count still intact", async () => {
    const db = fakeDb([like("l1", "m1", "a2")]);

    await expect(readNoteLikeState(db as never, "m1", null)).resolves.toEqual({
      liked: false,
      count: 1,
    });
    await expect(readNoteLikeState(db as never, "m1", "a1")).resolves.toEqual({
      liked: false,
      count: 1,
    });
  });

  it("batch counts every requested id from one query", async () => {
    const db = fakeDb([like("l1", "m1", "a1"), like("l2", "m1", "a2"), like("l3", "m2", "a1")]);

    const counts = await countNoteLikesForMany(db as never, ["m1", "m2", "m3"]);

    expect(Object.fromEntries(counts)).toEqual({ m1: 2, m2: 1, m3: 0 });
    expect(counts.size).toBe(3);
  });

  it("caps batch reads at NOTE_LIKE_BATCH_MAX ids", async () => {
    const db = fakeDb([]);
    const ids = Array.from({ length: NOTE_LIKE_BATCH_MAX + 5 }, (_, i) => `note-${i}`);

    const counts = await countNoteLikesForMany(db as never, ids);

    expect(NOTE_LIKE_BATCH_MAX).toBe(60);
    expect(counts.size).toBe(NOTE_LIKE_BATCH_MAX);
  });

  it("plans one delivery for a new like and none for an unlike", async () => {
    const base = {
      viewerAccountId: "a1",
      ownerAccountId: "owner-1",
      materialId: "m1",
      label: "IB Phys IA",
      slug: "ib-phys-ia",
    };

    const planned = planNoteLikeNotification({ ...base, liked: true, changed: true });
    expect(planned?.eventType).toBe("engagement.saved");
    expect(planned?.payload).toEqual({
      recipient_account_id: "owner-1",
      context: "teaching",
      entity_type: "material",
      action: "liked",
      label: "IB Phys IA",
      link: "/notes/ib-phys-ia",
    });
    expect(planDeliveriesForEvent(planned!.eventType)).toEqual({
      kind: "deliver",
      deliveries: [{ channel: "in_app", role: "recipient" }],
    });

    expect(planNoteLikeNotification({ ...base, liked: false, changed: true })).toBeNull();
    expect(planNoteLikeNotification({ ...base, liked: true, changed: false })).toBeNull();
  });

  it("never puts the liker's identity in the notification payload", async () => {
    const planned = planNoteLikeNotification({
      liked: true,
      changed: true,
      viewerAccountId: "a1",
      ownerAccountId: "owner-1",
      materialId: "m1",
      label: "IB Phys IA",
      slug: null,
    });

    expect(Object.keys(planned!.payload).sort()).toEqual([
      "action",
      "context",
      "entity_type",
      "label",
      "link",
      "recipient_account_id",
    ]);
    expect(planned!.payload.link).toBe("/notes/m1");
  });

  it("uses like copy for action:liked and keeps save copy without it", () => {
    const payload = { event_type: "engagement.saved", payload: {} as Record<string, unknown> };

    expect(
      bellLabel(
        {
          ...payload,
          payload: { action: "liked", entity_type: "material", label: "IB Phys IA" },
        },
        t,
      ),
    ).toBe('sor.bell_liked_note:{"label":"IB Phys IA"}');
    expect(
      bellLabel({ ...payload, payload: { entity_type: "material", label: "IB Phys IA" } }, t),
    ).toBe('sor.bell_saved_note:{"label":"IB Phys IA"}');
    expect(
      bellLabelKey({
        event_type: "engagement.saved",
        payload: { action: "liked", entity_type: "material" },
      }),
    ).toBe("sor.bell_liked_note");
  });
});
