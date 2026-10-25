/**
 * Issue #441 — manual risk flags on cases + tutors (V1: visibility + audit).
 *
 * Server-side gate + storage for the staff flag UI. The risk_flags table is
 * service-role only (RLS on, ZERO grants to anon/authenticated — the #383
 * case_flags posture), so every read/write runs through here:
 *
 *   * listRiskFlags — any staff (staff/admin/super_admin) reads flag rows
 *     for one entity type; the desk/shortlist surfaces map them by id.
 *   * setRiskFlag — any staff sets REVIEW or returns a flag to NONE; moving
 *     a flag INTO or OUT of BLOCKED is Operator-only (admin/super_admin,
 *     the #308 suspend/ban split — the product has no finer CS/Operator
 *     role today, so Operator = admin until a role split ships).
 *
 * Authority is re-checked server-side on every call. Nothing auto-writes a
 * flag: no trigger, no scheduled job, no WABA/display-name metadata read —
 * the only writer is a staff member pressing Save. Flags are display
 * metadata: no consumer may auto-delete, auto-archive, block matching, or
 * gate phone unlock on them.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import {
  buildRiskPatch,
  canSetRiskFlag,
  normalizeRiskFlag,
  RISK_FLAG_NOTE_MAX,
  type RiskFlag,
} from "@/features/admin/risk-flags";

export type RiskFlagEntity = "case" | "tutor";

/** One risk_flags row as the UI consumes it (staff-only surface). */
export type RiskFlagRow = {
  id: string;
  case_id: string | null;
  tutor_id: string | null;
  risk_flag: RiskFlag;
  risk_note: string | null;
  risk_flagged_at: string | null;
  risk_flagged_by: string | null;
};

type Row = Record<string, unknown>;

type HasRoleClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
};

async function hasAnyRole(
  supabase: unknown,
  userId: string,
  roles: readonly string[],
): Promise<boolean> {
  const client = supabase as HasRoleClient;
  for (const role of roles) {
    const { data } = await client.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return true;
  }
  return false;
}

/** REVIEW level: any CS staff member (or above). */
async function assertStaff(supabase: unknown, userId: string) {
  if (await hasAnyRole(supabase, userId, ["staff", "admin", "super_admin"])) return;
  throw new Error("Forbidden");
}

function toFlagRow(row: Row): RiskFlagRow {
  return {
    id: String(row.id),
    case_id: (row.case_id as string | null) ?? null,
    tutor_id: (row.tutor_id as string | null) ?? null,
    risk_flag: normalizeRiskFlag(row.risk_flag),
    risk_note: (row.risk_note as string | null) ?? null,
    risk_flagged_at: (row.risk_flagged_at as string | null) ?? null,
    risk_flagged_by: (row.risk_flagged_by as string | null) ?? null,
  };
}

const RISK_FLAG_COLUMNS =
  "id, case_id, tutor_id, risk_flag, risk_note, risk_flagged_at, risk_flagged_by";

export const listRiskFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ entity: z.enum(["case", "tutor"]) }).parse(input))
  .handler(async ({ context, data }): Promise<RiskFlagRow[]> => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    // The table only holds rows for entities that were flagged at least
    // once, so a full scan is the cheap default; the caller filters by the
    // ids it is rendering.
    const { data: rows, error } = await db
      .from<Row>("risk_flags")
      .select(RISK_FLAG_COLUMNS)
      .order("risk_flagged_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message ?? "risk flag list failed");
    const wantCase = data.entity === "case";
    return ((rows ?? []) as Row[])
      .filter((row) => (wantCase ? row.case_id != null : row.tutor_id != null))
      .map(toFlagRow);
  });

export const setRiskFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        entity: z.enum(["case", "tutor"]),
        id: z.string().uuid(),
        flag: z.string(),
        note: z.string().max(RISK_FLAG_NOTE_MAX).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true; flag: RiskFlag }> => {
    await assertStaff(context.supabase, context.userId);
    const operatorAuthority = await hasAnyRole(context.supabase, context.userId, [
      "admin",
      "super_admin",
    ]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const col = data.entity === "case" ? "case_id" : "tutor_id";

    // Current state decides the authority gate: moving INTO or OUT of
    // BLOCKED is an Operator action, any other transition is staff-level.
    const { data: currentRows, error: readError } = await db
      .from<Row>("risk_flags")
      .select("risk_flag")
      .eq(col, data.id)
      .limit(1);
    if (readError) throw new Error(readError.message ?? "risk flag read failed");
    const current = normalizeRiskFlag((currentRows ?? [])[0]?.risk_flag);
    const next = normalizeRiskFlag(data.flag);
    const gate = canSetRiskFlag({ current, next, operatorAuthority });
    if (!gate.ok) {
      throw new Error("Only an Operator (admin) can set or clear the Blocked flag");
    }

    const patch = buildRiskPatch({
      next,
      note: data.note ?? null,
      actorId: context.userId,
    });
    const { error } = await db
      .from<Row>("risk_flags")
      .upsert({ ...patch, [col]: data.id }, { onConflict: col });
    if (error) throw new Error(error.message ?? "risk flag write failed");
    return { ok: true, flag: next };
  });
