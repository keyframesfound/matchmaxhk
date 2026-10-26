import { asAdminDb } from "@/features/materials/storage-helpers";

import { buildTermsAcceptanceRow, type TermsSurface } from "./terms";

/**
 * Issue #214: insert a terms_acceptances row through the SERVICE-ROLE client.
 * The table has no client INSERT policy on purpose, an acceptance row may
 * only be written by the server fn that owns the gate, after that gate's
 * checkbox validation has passed. Fail-closed: any insert failure throws, so
 * the calling submit fails with a clear error and an acceptance that was
 * never recorded can never let the gated action through.
 *
 * Callers dynamic-import this module inside their handler (the repo's
 * *.server.ts pattern) so nothing server-only reaches the client bundle.
 */
export async function recordTermsAcceptance(params: {
  userId: string;
  surface: TermsSurface;
  /** Optional context row: application id, note draft id, or order id. */
  subjectId?: string | null;
  /** Override the recorded version (e.g. the fee-2026-10 matching-fee terms). */
  termsVersion?: string;
  /** #412 D: request IP at acceptance time (server-captured, best-effort). */
  ipAddress?: string | null;
  /** #412 D: centre-partnership rows, the legal entity the rep bound. */
  legalEntityName?: string | null;
  /** #412 D: exact checkbox label strings shown (audit trail outlives copy). */
  acceptanceDetails?: string[] | null;
}): Promise<void> {
  const row = buildTermsAcceptanceRow({
    userId: params.userId,
    surface: params.surface,
    termsVersion: params.termsVersion,
    subjectId: params.subjectId ?? null,
    ipAddress: params.ipAddress ?? null,
    legalEntityName: params.legalEntityName ?? null,
    acceptanceDetails: params.acceptanceDetails ?? null,
  });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = asAdminDb(supabaseAdmin);
  const { error } = await db.from<never>("terms_acceptances").insert(row);
  if (error) {
    throw new Error(
      `Could not record your Terms and Conditions acceptance: ${error.message || "database error"}`,
    );
  }
}
