/**
 * Issue #650 Safety lite — server fns for the trusted contact and the
 * per-case first-visit share lifecycle.
 *
 * BOTH tables are owner-SELECT-only under RLS (migration
 * 20261104120000): ZERO anon/authenticated writes — every write here goes
 * through the service-role client after the server has authenticated the
 * caller and, for the per-case stamps, verified that the case's parent_id
 * is the caller (dismissal state stays owner-scoped). This is the
 * terms_acceptances pattern (#214, hardened in #374): a hand-rolled
 * PostgREST call can neither save a contact nor flip share state.
 *
 * Fail-closed: validation and DB errors throw; the UI surfaces a toast and
 * a failed write never pretends to have happened.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { asAdminDb } from "@/features/materials/storage-helpers";
import {
  safetyShareStamp,
  validateTrustedContact,
  type CaseSafetyShareState,
  type SafetyShareStampKind,
  type TrustedContact,
} from "@/features/safety/safety-share";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Insert-or-replace the caller's ONE trusted contact (CEO lock: UNIQUE(parent_id)). */
export const saveTrustedContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ displayName: z.string(), phone: z.string() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ saved: true }> => {
    const validated = validateTrustedContact(data.displayName, data.phone);
    if (!validated.ok) {
      throw new Error(
        validated.reason === "name_required" ? "SAFETY_NAME_REQUIRED" : "SAFETY_PHONE_INVALID",
      );
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { error } = await db.from<TrustedContact>("trusted_contacts").upsert(
      {
        parent_id: context.userId,
        display_name: validated.displayName,
        phone: validated.phone,
      },
      { onConflict: "parent_id" },
    );
    if (error) throw new Error(error.message || "SAFETY_SAVE_FAILED");
    return { saved: true };
  });

/** Delete the caller's trusted contact (no-op when none saved). */
export const deleteTrustedContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ deleted: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { error } = await db
      .from<TrustedContact>("trusted_contacts")
      .delete()
      .eq("parent_id", context.userId);
    if (error) throw new Error(error.message || "SAFETY_DELETE_FAILED");
    return { deleted: true };
  });

const STAMP_INPUT = z.object({ caseId: z.string().uuid() });

/**
 * Verify the caller owns the case, then stamp the share lifecycle. Shared by
 * the three exported stamps below — the ownership check is what keeps the
 * dismissal state owner-scoped now that the table has no client writes.
 */
async function stampOwnedCase(
  userId: string,
  caseId: string,
  kind: SafetyShareStampKind,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = asAdminDb(supabaseAdmin);
  const { data, error } = await db
    .from<{ id: string; parent_id: string | null }>("tutoring_cases")
    .select("id, parent_id")
    .eq("id", caseId)
    .limit(1);
  if (error) throw new Error(error.message || "SAFETY_STATE_FAILED");
  const row = data?.[0];
  if (!row || row.parent_id !== userId) throw new Error("CASE_NOT_FOUND");
  const stamp = await db.from<CaseSafetyShareState>("case_safety_shares").upsert(
    { case_id: caseId, parent_id: userId, ...safetyShareStamp(kind) },
    // "seen" must never overwrite an existing row (a dismissed/shared prompt
    // stays dismissed/shared); dismiss/share DO update their own columns.
    { onConflict: "case_id", ignoreDuplicates: kind === "seen" },
  );
  if (stamp.error) throw new Error(stamp.error.message || "SAFETY_STATE_FAILED");
}

/** The one soft auto-prompt was rendered for this case (insert-only). */
export const markSafetyPromptSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => STAMP_INPUT.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await stampOwnedCase(context.userId, data.caseId, "seen");
    return { ok: true };
  });

/** Parent dismissed the prompt — never auto-nags for this case again. */
export const dismissSafetyVisitPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => STAMP_INPUT.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await stampOwnedCase(context.userId, data.caseId, "dismissed");
    return { ok: true };
  });

/** Parent actually shared (or copied) the visit window. */
export const markSafetyVisitShared = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => STAMP_INPUT.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await stampOwnedCase(context.userId, data.caseId, "shared");
    return { ok: true };
  });
