/**
 * Issue #387 — Tutor Verified Experience Log server fns.
 *
 *  * logTutorSession   — tutor logs a completed session (guardrailed),
 *  * disputeSession    — parent rejects a pending log ("did not happen"),
 *  * revokeSession     — staff/admin revokes any log (instant recalculation),
 *  * listCaseSessionLogs — admin desk list for one case.
 *
 * All rows live in tutor_session_logs (RLS-deny, service-role writes). The
 * pure guardrails live in features/tutors/experience.ts and run BEFORE any
 * write; the DB trigger + CHECK constraints are the backstop.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import type { SorStatus } from "@/features/cases/sor";
import { hktDateKey } from "@/features/cases/sor";
import {
  canLogOnCase,
  validateSessionLogInput,
  type ExperienceGuardReason,
} from "@/features/tutors/experience";

type Row = Record<string, unknown>;
type Db = ReturnType<typeof asAdminDb>;

async function selectRows<T extends Row>(
  db: Db,
  table: string,
  cols: string,
  match: { col: string; op: "eq" | "in"; value: unknown }[],
  order?: { col: string; asc?: boolean; limit?: number },
): Promise<T[]> {
  let q = db.from<T>(table).select(cols);
  for (const m of match) {
    if (m.op === "eq") q = q.eq(m.col, m.value);
    else q = q.in(m.col, m.value as unknown[]);
  }
  if (order) q = q.order(order.col, { ascending: order.asc ?? true });
  if (order?.limit) q = q.limit(order.limit);
  const { data } = await q;
  return (data ?? []) as T[];
}

async function insertAudit(
  db: Db,
  caseId: string,
  actorId: string | null,
  toStatus: string,
  reason: string | null,
): Promise<void> {
  await db
    .from<Row>("case_audit")
    .insert({ case_id: caseId, actor_id: actorId, to_status: toStatus, reason })
    .select("id")
    .single();
}

async function requireAdmin(db: Db, userId: string): Promise<void> {
  for (const role of ["admin", "super_admin"] as const) {
    const { data } = await db.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return;
  }
  throw new Error("FORBIDDEN");
}

async function resolveTutorId(db: Db, userId: string): Promise<string> {
  const rows = await selectRows<{ id: string }>(db, "tutors", "id", [
    { col: "user_id", op: "eq", value: userId },
  ]);
  if (rows.length === 0) throw new Error("NO_TUTOR_CARD");
  return rows[0].id;
}

/**
 * Lazy 72h auto-verify sweep (the sweep_past_due_gig_orders pattern): flip
 * pending logs older than 72h to verified on reads. Tolerant — a missing
 * RPC (pre-migration deploys) never fails the read.
 */
export async function sweepDueSessionLogs(db: Db): Promise<void> {
  try {
    await db.rpc("sweep_due_tutor_session_logs", {});
  } catch {
    // 42P01/PGRST202 — migration not applied yet; hide, never fail the read.
  }
}

export type SessionLogRowT = {
  id: string;
  case_id: string;
  log_date: string;
  start_minute: number;
  duration_min: number;
  status: "pending" | "verified" | "disputed" | "revoked";
  dispute_reason: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Tutor: log a completed session (lesson 3+ on fee-paid cases)
// ---------------------------------------------------------------------------

export const logTutorSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        startMinute: z.number().int(),
        durationMin: z.number().int(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await sweepDueSessionLogs(db);
    const tutorId = await resolveTutorId(db, context.userId);

    const caseRows = await selectRows<{
      id: string;
      matched_tutor_id: string | null;
      sor_status: SorStatus | null;
    }>(db, "tutoring_cases", "id, matched_tutor_id, sor_status", [
      { col: "id", op: "eq", value: data.caseId },
    ]);
    const c = caseRows[0];
    if (!c || c.matched_tutor_id !== tutorId) throw new Error("CASE_NOT_FOUND");
    if (c.sor_status === "replaced") throw new Error("CASE_CLOSED");

    const [fees, logs] = await Promise.all([
      selectRows<{ status: string }>(db, "case_fees", "status", [
        { col: "case_id", op: "eq", value: c.id },
      ]),
      selectRows<{ status: string }>(db, "tutor_session_logs", "status", [
        { col: "case_id", op: "eq", value: c.id },
      ]),
    ]);

    const gate = canLogOnCase({
      // #387: ongoing-session logging only on cases whose admin fee is paid.
      feePaid: fees.some((f) => f.status === "paid"),
      disputedCount: logs.filter((l) => l.status === "disputed").length,
    });
    if (gate) throw new Error(gate);

    const reason = validateSessionLogInput(data, hktDateKey(new Date()));
    if (reason) throw new Error(reason);

    const insert = db.from<Row>("tutor_session_logs").insert({
      case_id: c.id,
      tutor_id: tutorId,
      log_date: data.logDate,
      start_minute: data.startMinute,
      duration_min: data.durationMin,
      status: "pending",
    });
    const { error } = await (
      insert as unknown as {
        select: () => { single: () => Promise<{ error: { message: string } | null }> };
      }
    )
      .select()
      .single();
    if (error) {
      // UNIQUE(case_id, log_date): max 1 logged session per case per day.
      if (/duplicate|unique/i.test(error.message)) throw new Error("DUPLICATE_DAY");
      throw new Error(error.message);
    }
    await insertAudit(db, c.id, context.userId, "experience_log_pending", null);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Parent: dispute a pending log ("Dispute / Did not happen")
// ---------------------------------------------------------------------------

export const disputeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ logId: z.string().uuid(), reason: z.string().max(500).optional() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

    const rows = await selectRows<{
      id: string;
      status: string;
      case_id: string;
      tutoring_cases: { parent_id: string | null } | null;
    }>(db, "tutor_session_logs", "id, status, case_id, tutoring_cases(parent_id)", [
      { col: "id", op: "eq", value: data.logId },
    ]);
    const log = rows[0];
    if (!log || log.tutoring_cases?.parent_id !== context.userId) {
      throw new Error("LOG_NOT_FOUND");
    }
    if (log.status !== "pending") throw new Error("NOT_PENDING");

    const { error } = await db
      .from<Row>("tutor_session_logs")
      .update({
        status: "disputed",
        disputed_at: new Date().toISOString(),
        dispute_reason: data.reason?.trim() || null,
      })
      .eq("id", log.id);
    if (error) throw new Error(error.message);
    // Operator-review breadcrumb: the disputed log (and its reason) shows on
    // the SoR desk's Experience logs section; two disputes lock the case.
    await insertAudit(
      db,
      log.case_id,
      context.userId,
      "experience_log_disputed",
      data.reason?.trim() || null,
    );
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Staff/admin: revoke any log — public totals recalculate instantly
// ---------------------------------------------------------------------------

export const revokeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ logId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);

    const rows = await selectRows<{ id: string; status: string; case_id: string }>(
      db,
      "tutor_session_logs",
      "id, status, case_id",
      [{ col: "id", op: "eq", value: data.logId }],
    );
    const log = rows[0];
    if (!log) throw new Error("LOG_NOT_FOUND");
    if (log.status === "revoked") return { ok: true };

    const { error } = await db
      .from<Row>("tutor_session_logs")
      .update({ status: "revoked", revoked_by: context.userId })
      .eq("id", log.id);
    if (error) throw new Error(error.message);
    await insertAudit(db, log.case_id, context.userId, "experience_log_revoked", null);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Staff/admin: list the logs of one case (SoR desk section)
// ---------------------------------------------------------------------------

export const listCaseSessionLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<SessionLogRowT[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);
    await sweepDueSessionLogs(db);
    return selectRows<SessionLogRowT>(
      db,
      "tutor_session_logs",
      "id, case_id, log_date, start_minute, duration_min, status, dispute_reason, created_at",
      [{ col: "case_id", op: "eq", value: data.caseId }],
      { col: "log_date", asc: false },
    );
  });

export type { ExperienceGuardReason };
