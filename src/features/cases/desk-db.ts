/**
 * Shared service-role helpers for the #537 desk server fns (drop-protection +
 * trust). Same shapes as the per-file copies in short-case.functions.ts and
 * admin-desk.functions.ts; new desk fns import these instead of adding a copy.
 */

import type { asAdminDb } from "@/features/materials/storage-helpers";

export type Row = Record<string, unknown>;
export type Db = ReturnType<typeof asAdminDb>;

export type Match = { col: string; op: "eq" | "in"; value: unknown };

export async function selectRows<T extends Row>(
  db: Db,
  table: string,
  cols: string,
  match: Match[],
  order?: { col: string; asc?: boolean; limit?: number },
): Promise<T[]> {
  let q = db.from<T>(table).select(cols);
  for (const m of match) {
    q = m.op === "eq" ? q.eq(m.col, m.value) : q.in(m.col, m.value as unknown[]);
  }
  if (order) q = q.order(order.col, { ascending: order.asc ?? true });
  if (order?.limit) q = q.limit(order.limit);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

/**
 * Like selectRows, but a failed read (e.g. a table not migrated yet) logs and
 * returns [] instead of throwing. Only for reads that have a safe default.
 */
export async function selectRowsOrEmpty<T extends Row>(
  db: Db,
  table: string,
  cols: string,
  match: Match[],
): Promise<T[]> {
  try {
    return await selectRows<T>(db, table, cols, match);
  } catch (e) {
    console.warn(
      `[desk-db] ${table} read failed, using default:`,
      e instanceof Error ? e.message : e,
    );
    return [];
  }
}

/** admin / super_admin only (fee and trust decisions are Operator actions). */
export async function requireAdmin(db: Db, userId: string): Promise<void> {
  for (const role of ["admin", "super_admin"] as const) {
    const { data } = await db.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return;
  }
  throw new Error("FORBIDDEN");
}

export async function insertAudit(
  db: Db,
  caseId: string,
  actorId: string | null,
  toStatus: string,
  reason: string | null,
): Promise<void> {
  const { error } = await db
    .from<Row>("case_audit")
    .insert({ case_id: caseId, actor_id: actorId, from_status: null, to_status: toStatus, reason })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
}

export async function readSetting(db: Db, key: string): Promise<unknown> {
  const { data } = await db
    .from<{ value: unknown }>("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? null;
}
