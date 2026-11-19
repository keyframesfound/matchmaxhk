/**
 * #782 §2.1: Safety Attestation server fns + the gate the tutor actions call
 * (apply / accept a case, submit a storefront item). Service role only; the
 * table has RLS on with no policies.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db, type Row } from "@/features/cases/desk-db";
import {
  SAFETY_ATTESTATION_VERSION,
  allChecksTicked,
  attestationRequired,
} from "@/features/trust/safety-attestation";

async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return asAdminDb(supabaseAdmin);
}

async function loadRequirement(db: Db, userId: string): Promise<boolean> {
  const [tutors, rows] = await Promise.all([
    selectRows<{ id: string; is_community_seller: boolean | null }>(
      db,
      "tutors",
      "id, is_community_seller",
      [{ col: "user_id", op: "eq", value: userId }],
    ),
    selectRows<{ attestation_version: string }>(db, "safety_attestations", "attestation_version", [
      { col: "user_id", op: "eq", value: userId },
    ]),
  ]);
  return attestationRequired({
    hasTutorCard: tutors.length > 0,
    isCommunitySellerOnly: tutors.length > 0 && tutors.every((t) => t.is_community_seller === true),
    acceptedVersions: rows.map((r) => r.attestation_version),
  });
}

/** Throws SAFETY_ATTESTATION_REQUIRED when a tutor has not attested yet. */
export async function assertSafetyAttestation(userId: string): Promise<void> {
  const db = await adminDb();
  if (await loadRequirement(db, userId)) throw new Error("SAFETY_ATTESTATION_REQUIRED");
}

export const getMySafetyAttestation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ required: boolean; version: string }> => {
    const db = await adminDb();
    return {
      required: await loadRequirement(db, context.userId),
      version: SAFETY_ATTESTATION_VERSION,
    };
  });

export const acceptSafetyAttestation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        version: z.string().max(20),
        clean_record: z.boolean(),
        zero_illegal: z.boolean(),
        independent_operator: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (data.version !== SAFETY_ATTESTATION_VERSION) throw new Error("ATTESTATION_VERSION_STALE");
    if (!allChecksTicked(data)) throw new Error("ATTESTATION_INCOMPLETE");

    const { getRequest } = await import("@tanstack/react-start/server");
    const headers = getRequest()?.headers;
    const ip =
      headers?.get("cf-connecting-ip") ??
      headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      null;

    const db = await adminDb();
    const { error } = await db.from<Row>("safety_attestations").upsert(
      {
        user_id: context.userId,
        attestation_version: SAFETY_ATTESTATION_VERSION,
        safety_attestation_accepted_at: new Date().toISOString(),
        attestation_ip_address: ip,
        user_agent: headers?.get("user-agent")?.slice(0, 300) ?? null,
      },
      { onConflict: "user_id,attestation_version", ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
