import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server-side reads for the /admin overview queue cards.
 *
 * `reports` has no admin SELECT policy (20261011000000 — staff access is
 * enforced in the reports server fns) and `case_fees` is RLS-deny with all
 * client grants revoked (20261017150000 lockdown block), so the browser
 * client can read neither: the reports queue silently returned 0 rows and
 * the case_fees read hard-failed the whole overview fetch. Everything here
 * goes through the service-role client behind the same has_role gate the
 * other admin server fns use.
 */

export type OverviewReportRow = {
  id: string;
  target_type: string;
  reason: string;
  created_at: string;
};

export type OverviewFeeRow = {
  id: string;
  amount_hkd: number;
  due_at: string | null;
  created_at: string;
  case_code: string | null;
};

export type AdminOverviewProtected = {
  reportCount: number;
  reports: OverviewReportRow[];
  fees: OverviewFeeRow[];
};

type LooseResult = { data: unknown; count: number | null; error: { message: string } | null };
type LooseQuery = {
  select: (columns: string, options?: { count: "exact"; head: boolean }) => LooseQuery;
  eq: (column: string, value: string) => LooseQuery;
  order: (column: string, options: { ascending: boolean }) => LooseQuery;
  limit: (count: number) => LooseQuery;
  then<TResult1 = LooseResult, TResult2 = never>(
    onfulfilled?: ((value: LooseResult) => TResult1 | PromiseLike<TResult1>) | null,
  ): PromiseLike<TResult1 | TResult2>;
};

async function assertAdmin(context: { userId: string; supabase: unknown }): Promise<void> {
  const client = context.supabase as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error?: { message?: string } }>;
  };
  for (const role of ["admin", "super_admin"] as const) {
    const { data, error } = await client.rpc("has_role", {
      _user_id: context.userId,
      _role: role,
    });
    if (!error && data === true) return;
  }
  throw new Error("Forbidden");
}

export const fetchAdminOverviewProtected = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as { from: (table: string) => LooseQuery };

    const [
      { count: reportCount, error: reportCountError },
      { data: reportRows, error: reportRowsError },
      { data: feeRows, error: feeRowsError },
    ] = await Promise.all([
      admin.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
      admin
        .from("reports")
        .select("id, target_type, reason, created_at")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(3),
      admin
        .from("case_fees")
        .select("id, amount_hkd, due_at, created_at, tutoring_cases(case_code)")
        .eq("status", "invoiced")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    if (reportCountError) throw new Error(reportCountError.message);
    if (reportRowsError) throw new Error(reportRowsError.message);
    if (feeRowsError) throw new Error(feeRowsError.message);

    const fees = ((feeRows ?? []) as Array<Record<string, unknown>>).map((row) => {
      const embedded = Array.isArray(row.tutoring_cases)
        ? (row.tutoring_cases[0] as { case_code?: string } | null)
        : (row.tutoring_cases as { case_code?: string } | null);
      return {
        id: String(row.id),
        amount_hkd: Number(row.amount_hkd),
        due_at: (row.due_at as string | null) ?? null,
        created_at: String(row.created_at),
        case_code: embedded?.case_code ?? null,
      };
    });

    return {
      reportCount: reportCount ?? 0,
      reports: (reportRows ?? []) as OverviewReportRow[],
      fees,
    } satisfies AdminOverviewProtected;
  });
