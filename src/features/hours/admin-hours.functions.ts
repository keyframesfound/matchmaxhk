/**
 * Issue #459 slice 8 — staff hours reconcile (§8.5/§11 AC, read-only).
 *
 * The public counters are computed live as SUM(duration_hours) over
 * verified_completed ledger rows, so drift is structurally impossible; this
 * panel is the visible proof surface: it shows the same three ledger
 * buckets (verified / pending / disputed) and re-derives "displayed" through
 * the exact public RPC the tutor card uses, so the ✓/✗ line is a real
 * parity check, not decoration. There is deliberately no edit button —
 * fixing a wrong row means fixing the lesson (#461 void path), never the
 * counter.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";

type HasRoleClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
};

async function hasAnyRole(client: HasRoleClient, userId: string, roles: readonly string[]) {
  for (const role of roles) {
    const { data } = await client.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return true;
  }
  return false;
}

export type TutorHoursReconcile = {
  tutorCode: string | null;
  displayName: string | null;
  /** What the public card shows (via get_tutor_verified_hours). */
  publicHours: number;
  /** Direct ledger SUM over verified_completed rows. */
  verifiedHours: number;
  pendingHours: number;
  disputedHours: number;
  verifiedCount: number;
  pendingCount: number;
  disputedCount: number;
  lastVerifiedAt: string | null;
};

export const adminReconcileTutorHours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ tutorId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<TutorHoursReconcile> => {
    const authorized = await hasAnyRole(
      context.supabase as unknown as HasRoleClient,
      context.userId,
      ["staff", "admin", "super_admin"],
    );
    if (!authorized) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

    const [head, rows, publicHours] = await Promise.all([
      db
        .from<{ tutor_code: string | null; display_name: string | null }>("tutors")
        .select("tutor_code, display_name")
        .eq("id", data.tutorId)
        .maybeSingle(),
      db
        .from<{ status: string; duration_hours: number | string; verified_at: string | null }>(
          "verified_hours_ledger",
        )
        .select("status, duration_hours, verified_at")
        .eq("tutor_id", data.tutorId),
      db.rpc("get_tutor_verified_hours", { _tutor_id: data.tutorId }),
    ]);

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const sumBy = (status: string) =>
      round2(
        (rows.data ?? [])
          .filter((row) => row.status === status)
          .reduce((sum, row) => sum + Number(row.duration_hours), 0),
      );
    const countBy = (status: string) =>
      (rows.data ?? []).filter((row) => row.status === status).length;
    const lastVerifiedAt =
      (rows.data ?? [])
        .map((row) => row.verified_at)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null;

    const rpcHours = Number(
      Array.isArray(publicHours.data) ? publicHours.data[0] : publicHours.data,
    );

    return {
      tutorCode: head.data?.tutor_code ?? null,
      displayName: head.data?.display_name ?? null,
      publicHours: Number.isFinite(rpcHours) ? round2(rpcHours) : 0,
      verifiedHours: sumBy("verified_completed"),
      pendingHours: sumBy("pending_confirmation"),
      disputedHours: sumBy("disputed"),
      verifiedCount: countBy("verified_completed"),
      pendingCount: countBy("pending_confirmation"),
      disputedCount: countBy("disputed"),
      lastVerifiedAt,
    };
  });
