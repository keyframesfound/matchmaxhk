/**
 * Issue #535 — trust desk server fns: case_risk_flags + trust_blacklist.
 *
 * Admin-gated, service-role only (both tables have zero client grants).
 * Humans set and lift blacklist rows; `ai_advisory` / `system` flags only
 * raise visibility and revoke contact reveal, they never ban (#529 §5).
 *
 *  - raiseCaseRiskFlag / resolveCaseRiskFlag — desk add / clear
 *  - liftBlacklistEntry                     — stamp lifted_at (audit kept)
 *  - flagIfBlacklisted                      — server-only intake hook used by
 *    submitCaseRequest: a blacklisted parent's new request is NOT rejected
 *    (no tip-off), it lands with an open BLACKLISTED_CONTACT flag so the desk
 *    does not rematch that household.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { insertAudit, requireAdmin, selectRows, type Db, type Row } from "@/features/cases/desk-db";
import { CASE_RISK_FLAG_TYPES, hashPhone, type CaseRiskFlagType } from "@/features/trust/trust";

/** Insert an open flag; the partial unique index makes a re-raise a no-op. */
async function insertOpenFlag(
  db: Db,
  row: {
    case_id: string;
    flag_type: CaseRiskFlagType;
    source: "manual" | "ai_advisory" | "system";
    source_channel: "website_form" | "whatsapp_webhook" | "desk";
    note: string | null;
    created_by: string | null;
  },
): Promise<void> {
  const existing = await selectRows<{ id: string; resolved_at: string | null }>(
    db,
    "case_risk_flags",
    "id, resolved_at",
    [
      { col: "case_id", op: "eq", value: row.case_id },
      { col: "flag_type", op: "eq", value: row.flag_type },
    ],
  );
  if (existing.some((f) => f.resolved_at === null)) return;
  const { error } = await db.from<Row>("case_risk_flags").insert(row).select("id").single();
  if (error) throw new Error(error.message);
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
    const live = await liveParentEntries(db, c.parent_id, await hashPhone(c.contact_phone));
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

/**
 * Server-only intake hook (not a server fn): call after a case row exists.
 * Never throws — trust bookkeeping must not fail a parent's submit.
 */
export async function flagIfBlacklisted(input: {
  caseId: string;
  parentId: string | null;
  contactPhone: string | null;
}): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const live = await liveParentEntries(db, input.parentId, await hashPhone(input.contactPhone));
    if (live.length === 0) return false;
    await insertOpenFlag(db, {
      case_id: input.caseId,
      flag_type: "BLACKLISTED_CONTACT",
      source: "system",
      source_channel: "website_form",
      note: "Requester matches a live trust_blacklist entry. Do not rematch this household.",
      created_by: null,
    });
    return true;
  } catch (e) {
    console.error("[trust] blacklist intake check failed:", e instanceof Error ? e.message : e);
    return false;
  }
}
