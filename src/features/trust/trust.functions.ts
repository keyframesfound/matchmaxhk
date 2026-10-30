/**
 * Issue #535 — trust desk server fns: case_risk_flags + trust_blacklist.
 *
 * Admin-gated, service-role only (both tables have zero client grants).
 * Humans set and lift blacklist rows; `ai_advisory` / `system` flags only
 * raise visibility and revoke contact reveal, they never ban (#529 §5).
 *
 *  - raiseCaseRiskFlag / resolveCaseRiskFlag — desk add / clear
 *  - liftBlacklistEntry                     — stamp lifted_at (audit kept)
 *  - runIntakeTrustChecks                   — server-only intake hook used by
 *    submitCaseRequest: #529 screen hits, blacklist match (held, not
 *    rejected, no tip-off) and serial-hopper history become flags.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import {
  insertAudit,
  requireAdmin,
  selectRows,
  selectRowsOrEmpty,
  type Db,
  type Row,
} from "@/features/cases/desk-db";
import { CASE_RISK_FLAG_TYPES, type CaseRiskFlagType } from "@/features/trust/trust";
import { isSerialHopper, type ScreenHit } from "@/features/trust/safety-screen";

/** Keyed blacklist phone hash; dynamic import keeps the secret read server-only. */
async function phoneKey(raw: string | null): Promise<string | null> {
  const { hashPhone } = await import("@/features/trust/phone-hash.server");
  return hashPhone(raw);
}

/**
 * Insert an open flag; re-raising an open type is a no-op (partial unique
 * index backstop). Resolves true only when a new row was written.
 */
export async function insertOpenFlag(
  db: Db,
  row: {
    case_id: string;
    flag_type: CaseRiskFlagType;
    source: "manual" | "ai_advisory" | "system";
    source_channel: "website_form" | "whatsapp_webhook" | "desk";
    note: string | null;
    created_by: string | null;
  },
): Promise<boolean> {
  const existing = await selectRows<{ id: string; resolved_at: string | null }>(
    db,
    "case_risk_flags",
    "id, resolved_at",
    [
      { col: "case_id", op: "eq", value: row.case_id },
      { col: "flag_type", op: "eq", value: row.flag_type },
    ],
  );
  if (existing.some((f) => f.resolved_at === null)) return false;
  const { error } = await db.from<Row>("case_risk_flags").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  return true;
}

async function liveParentEntries(
  db: Db,
  parentId: string | null,
  phoneHash: string | null,
): Promise<string[]> {
  const ids = new Set<string>();
  const keys: Array<[string, string]> = [];
  if (parentId) keys.push(["parent_id", parentId]);
  if (phoneHash) keys.push(["phone_hash", phoneHash]);
  for (const [col, value] of keys) {
    const rows = await selectRows<{ id: string; lifted_at: string | null }>(
      db,
      "trust_blacklist",
      "id, lifted_at",
      [{ col, op: "eq", value }],
    );
    for (const r of rows) if (r.lifted_at === null) ids.add(r.id);
  }
  return [...ids];
}

export const raiseCaseRiskFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        flagType: z.enum(CASE_RISK_FLAG_TYPES),
        note: z.string().trim().max(500).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);
    await insertOpenFlag(db, {
      case_id: data.caseId,
      flag_type: data.flagType,
      source: "manual",
      source_channel: "desk",
      note: data.note || null,
      created_by: context.userId,
    });
    await insertAudit(db, data.caseId, context.userId, "risk_flag_raised", data.flagType);
    return { ok: true };
  });

export const resolveCaseRiskFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ flagId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);
    const rows = await selectRows<{ id: string; case_id: string; flag_type: string }>(
      db,
      "case_risk_flags",
      "id, case_id, flag_type",
      [{ col: "id", op: "eq", value: data.flagId }],
    );
    const flag = rows[0];
    if (!flag) throw new Error("FLAG_NOT_FOUND");
    const { error } = await db
      .from<Row>("case_risk_flags")
      .update({ resolved_at: new Date().toISOString(), resolved_by: context.userId })
      .eq("id", flag.id);
    if (error) throw new Error(error.message);
    await insertAudit(db, flag.case_id, context.userId, "risk_flag_resolved", flag.flag_type);
    return { ok: true };
  });

export const liftBlacklistEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ lifted: number }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);
    const cases = await selectRows<{ parent_id: string | null; contact_phone: string | null }>(
      db,
      "tutoring_cases",
      "parent_id, contact_phone",
      [{ col: "id", op: "eq", value: data.caseId }],
    );
    const c = cases[0];
    if (!c) throw new Error("CASE_NOT_FOUND");
    const live = await liveParentEntries(db, c.parent_id, await phoneKey(c.contact_phone));
    for (const id of live) {
      const { error } = await db
        .from<Row>("trust_blacklist")
        .update({ lifted_at: new Date().toISOString(), lifted_by: context.userId })
        .eq("id", id);
      if (error) throw new Error(error.message);
    }
    await insertAudit(
      db,
      data.caseId,
      context.userId,
      "blacklist_lifted",
      `${live.length} entries`,
    );
    return { lifted: live.length };
  });

/** Early-drop timestamps for this household (by account or by phone). */
async function householdDropTimes(
  db: Db,
  parentId: string | null,
  contactPhone: string | null,
): Promise<string[]> {
  const seen = new Map<string, string>();
  const keys: Array<[string, string]> = [];
  if (parentId) keys.push(["parent_id", parentId]);
  if (contactPhone) keys.push(["contact_phone", contactPhone]);
  for (const [col, value] of keys) {
    const rows = await selectRowsOrEmpty<{ id: string; drop_recorded_at: string | null }>(
      db,
      "tutoring_cases",
      "id, drop_recorded_at",
      [
        { col, op: "eq", value },
        { col: "drop_outcome", op: "eq", value: "stopped_after_l1" },
      ],
    );
    for (const r of rows) if (r.drop_recorded_at) seen.set(r.id, r.drop_recorded_at);
  }
  return [...seen.values()];
}

/**
 * Server-only intake hook (not a server fn): call after a case row exists.
 * Persists the #529 screen hits, the #535 blacklist match (which also holds
 * the case, no tip-off) and the #529 serial-hopper history flag, then pings
 * ops when anything held. Never throws — trust bookkeeping must not fail a
 * parent's submit.
 */
export async function runIntakeTrustChecks(input: {
  caseId: string;
  parentId: string | null;
  contactPhone: string | null;
  screenHits: readonly ScreenHit[];
}): Promise<void> {
  // Each step is isolated: one failed write must not skip the hold, the
  // other flags or the ops ping (a held case with no flag is invisible).
  const step = async (label: string, run: () => Promise<void>): Promise<void> => {
    try {
      await run();
    } catch (e) {
      console.error(`[trust] intake ${label} failed:`, e instanceof Error ? e.message : e);
    }
  };
  let db: Db;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    db = asAdminDb(supabaseAdmin);
  } catch (e) {
    console.error("[trust] intake checks unavailable:", e instanceof Error ? e.message : e);
    return;
  }
  const flag = (flagType: CaseRiskFlagType, note: string) =>
    insertOpenFlag(db, {
      case_id: input.caseId,
      flag_type: flagType,
      source: "system",
      source_channel: "website_form",
      note,
      created_by: null,
    });

  let isBlacklisted = false;
  await step("blacklist", async () => {
    const live = await liveParentEntries(db, input.parentId, await phoneKey(input.contactPhone));
    isBlacklisted = live.length > 0;
    if (!isBlacklisted) return;
    // Hold first (only a fresh `new` request: never overwrite a status the
    // desk has already moved), then record why.
    const { error } = await db
      .from<Row>("tutoring_cases")
      .update({ status: "compliance_hold" })
      .eq("id", input.caseId)
      .eq("status", "new");
    if (error) throw new Error(error.message);
    await flag(
      "BLACKLISTED_CONTACT",
      "Requester matches a live trust_blacklist entry. Do not rematch this household.",
    );
  });

  const held = isBlacklisted || input.screenHits.some((h) => h.hold);
  if (held) {
    await step("ops ping", async () => {
      const { notifyOps } = await import("@/lib/ops-webhook.server");
      void notifyOps("case_request.safety_hold", { case_id: input.caseId }).catch(() => {});
    });
  }

  for (const hit of input.screenHits) {
    await step(`flag ${hit.flagType}`, async () => {
      await flag(hit.flagType, `Matched: ${hit.evidence}`);
    });
  }

  await step("serial hopper", async () => {
    const drops = await householdDropTimes(db, input.parentId, input.contactPhone);
    if (!isSerialHopper(drops, new Date())) return;
    await flag(
      "SERIAL_HOPPER_PARENT",
      `${drops.length} early drops on record. Next dispatch: online trial only or L1 deposit.`,
    );
  });
}
