/**
 * #782 §2.4 Emergency Suspend gate. Staff-only kill-switch sets
 * tutors.suspended_at; every tutor-side accept / upload / publish server fn
 * calls assertNotSuspended (next to the #782 §2.1 attestation gate) so a
 * suspended account is blocked immediately. Service role only; the column is
 * read straight off tutors, no policies involved.
 */

import { asAdminDb } from "@/features/materials/storage-helpers";

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return asAdminDb(supabaseAdmin);
}

/** Throws ACCOUNT_SUSPENDED when the acting tutor account is suspended. */
export async function assertNotSuspended(userId: string): Promise<void> {
  const db = await adminDb();
  const rows = await db
    .from<{ suspended_at: string | null }>("tutors")
    .select("suspended_at")
    .eq("user_id", userId)
    .limit(1);
  const suspended = (rows.data ?? []).some((row) => row.suspended_at !== null);
  if (suspended) throw new Error("ACCOUNT_SUSPENDED");
}
