import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Issue #250 groundwork (stacked on the #131–#134 marketplace MVP):
 * order enforcement + staff grants. This is the minimal slice of #203's
 * "manual cashier" needed by #250's acceptance items — it is NOT the
 * full #203 checkout (no buyer-facing checkout UI, no receipt email,
 * no monthly statement batches) and NOT #201 (no case linkage).
 *
 * Invariants enforced here:
 *   - The private original is only ever signed for a buyer whose order is
 *     `delivered` ("no delivered order, no unlock").
 *   - A staff grant is an order at HK$0: status delivered, tutor_net 0,
 *     is_grant true. The payout export EXCLUDES is_grant rows.
 *   - One order per (material, buyer) — a second checkout or a duplicate
 *     grant is blocked (PK on the unique constraint).
 *   - The buyer never sees the tutor's contact details and the tutor never
 *     sees the buyer's identity (only opaque ids cross these surfaces).
 *
 * All writes go through the service-role client; the material_orders RLS
 * policies are read-only for clients on purpose.
 */

const ADMIN_ROLES = ["admin", "super_admin"] as const;

type HasRoleClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error?: { message?: string } }>;
};

/** Mirrors the pattern used across the branch's admin server functions. */
async function assertAdmin(client: unknown, userId: string): Promise<void> {
  const rpc = (client as HasRoleClient).rpc;
  for (const role of ADMIN_ROLES) {
    const { data: ok, error } = await rpc("has_role", {
      _user_id: userId,
      _role: role,
    });
    if (!error && ok === true) return;
  }
  throw new Error("Forbidden");
}

type OrderRow = {
  id: string;
  material_id: string;
  buyer_account_id: string;
  tutor_id: string;
  gross_hkd: number;
  platform_fee_hkd: number;
  tutor_net_hkd: number;
  status: string;
  is_grant: boolean;
  granted_by: string | null;
  grant_reason: string | null;
  fps_reference: string | null;
  paid_at: string | null;
  delivered_at: string | null;
  delivered_by: string | null;
  created_at: string;
};

type OrdersClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (
        col: string,
        value: string,
      ) => {
        eq: (
          col: string,
          value: string,
        ) => {
          maybeSingle: () => Promise<{
            data: OrderRow | null;
            error?: { message: string } | null;
          }>;
        };
        maybeSingle: () => Promise<{
          data: OrderRow | null;
          error?: { message: string } | null;
        }>;
        limit: (n: number) => Promise<{
          data: OrderRow[] | null;
          error?: { message: string } | null;
        }>;
      };
      or: (expr: string) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => {
          limit: (n: number) => Promise<{
            data: OrderRow[] | null;
            error?: { message: string } | null;
          }>;
        };
      };
    };
    insert: (rows: unknown) => {
      select: (cols: string) => {
        single: () => Promise<{
          data: OrderRow | null;
          error?: { message: string } | null;
        }>;
      };
    };
  };
};

type MaterialsAdminClient = {
  from: (table: string) => {
    select: (cols: string) => {
      in: (
        col: string,
        values: string[],
      ) => {
        eq: (
          col: string,
          value: boolean,
        ) => Promise<{
          data: Array<{ id: string; tutor_id: string }> | null;
          error?: { message: string } | null;
        }>;
      };
    };
  };
};

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * #250 acceptance: "A buyer cannot unlock a file without a delivered order."
 * Signs the PRIVATE original for the buying account only after checking a
 * delivered order exists. Signed URL expires in 10 minutes; buyers may
 * re-download for 180 days (#203) — enforced by the order staying delivered
 * (refunds revoke access by flipping status away from delivered).
 */
export const getOwnedMaterialUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ materialId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order, error } = await (supabaseAdmin as unknown as OrdersClient)
      .from("material_orders")
      .select("*")
      .eq("material_id", data.materialId)
      .eq("buyer_account_id", context.userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!order || order.status !== "delivered") {
      // Deliberately identical for "no order" and "not delivered" so the
      // error does not leak which packs another account holds.
      throw new Error("This pack is not unlocked for your account.");
    }

    const { data: material, error: materialError } = await (
      supabaseAdmin as unknown as OrdersClient
    )
      .from("digital_materials")
      .select("original_file_path")
      .eq("id", data.materialId)
      .maybeSingle();
    const originalPath = (material as unknown as { original_file_path?: string })
      ?.original_file_path;
    if (materialError || !originalPath) throw new Error("Material not found");

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("materials-originals")
      .createSignedUrl(originalPath, 60 * 10); // 10 minutes (#203)
    if (signError || !signed) {
      throw new Error(signError?.message || "Failed to sign URL");
    }
    return { signedUrl: signed.signedUrl };
  });

/**
 * Staff grant (#250 Rule): after three paid lessons staff may grant the
 * parent the tutor's CURRENTLY PUBLISHED packs at HK$0. Implemented as one
 * delivered HK$0 order per pack; packs published later are NOT included
 * (the admin picks packs at grant time). tutor_net is 0 and the rows are
 * excluded from the payout export. Re-granting an existing holder is
 * blocked by the (material_id, buyer_account_id) unique constraint.
 */
export const staffGrantMaterials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        buyerAccountId: z.string().uuid(),
        materialIds: z.array(z.string().uuid()).min(1).max(50),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as MaterialsAdminClient;

    const { data: materials, error } = await admin
      .from("digital_materials")
      .select("id, tutor_id")
      .in("id", data.materialIds)
      .eq("is_published", true);
    if (error) throw new Error(error.message);
    const found = new Set((materials ?? []).map((m) => m.id));
    const missing = data.materialIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      // Also fires for an unpublished/unlisted id: the grant covers the
      // packs the tutor has published at this moment, nothing else.
      throw new Error("One or more packs are not published for this tutor.");
    }

    // Current packs only: a pack that stops being published after the grant
    // keeps its delivered order (#203: unpublishing does not remove access),
    // but a pack that is not published right now is not granted.
    const rows = (materials ?? []).map((m) => ({
      material_id: m.id,
      buyer_account_id: data.buyerAccountId,
      tutor_id: m.tutor_id,
      gross_hkd: 0,
      platform_fee_hkd: 0,
      tutor_net_hkd: 0,
      status: "delivered",
      is_grant: true,
      granted_by: context.userId,
      grant_reason: data.reason,
      delivered_at: new Date().toISOString(),
      delivered_by: context.userId,
    }));

    const { data: inserted, error: insertError } = await (
      supabaseAdmin as unknown as {
        from: (t: string) => {
          insert: (rows: unknown) => {
            select: (c: string) => Promise<{
              data: OrderRow[] | null;
              error?: { message: string } | null;
            }>;
          };
        };
      }
    )
      .from("material_orders")
      .insert(rows)
      .select("id, material_id");
    if (insertError) {
      if (insertError.message.includes("duplicate key")) {
        throw new Error("One or more packs are already unlocked for this account.");
      }
      throw new Error(insertError.message);
    }
    return { granted: inserted?.length ?? 0 };
  });

export type PayoutExportRow = {
  order_id: string;
  delivered_at: string;
  tutor_id: string;
  tutor_display_name: string;
  material_title: string;
  gross_hkd: number;
  platform_fee_hkd: number;
  tutor_net_hkd: number;
};

/**
 * #250 acceptance: "A zero-price grant does not appear in the tutor payout
 * export." Exports delivered, NON-grant orders as CSV for the manual
 * monthly payout (#203 Flow step 7 — admin pays by hand). Grant rows are
 * excluded by is_grant, and HK$0 rows by amount, so a grant can never
 * surface via either path.
 */
export const exportTutorPayoutCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (
      supabaseAdmin as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (
              c: string,
              v: string,
            ) => {
              eq: (
                c: string,
                v: boolean,
              ) => {
                neq: (
                  c: string,
                  v: string,
                ) => {
                  order: (
                    c: string,
                    opts: { ascending: boolean },
                  ) => Promise<{
                    data: Array<{
                      id: string;
                      delivered_at: string;
                      tutor_id: string;
                      gross_hkd: number;
                      platform_fee_hkd: number;
                      tutor_net_hkd: number;
                      is_grant: boolean;
                      digital_materials: {
                        title: string;
                      } | null;
                      tutors: { display_name: string } | null;
                    }> | null;
                    error?: { message: string } | null;
                  }>;
                };
              };
            };
          };
        };
      }
    )
      .from("material_orders")
      .select(
        "id, delivered_at, tutor_id, gross_hkd, platform_fee_hkd, tutor_net_hkd, is_grant, digital_materials(title), tutors(display_name)",
      )
      .eq("status", "delivered")
      .eq("is_grant", false)
      .neq("gross_hkd", "0")
      .order("delivered_at", { ascending: true });
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const csvEscape = (value: string): string => `"${value.replace(/"/g, '""')}"`;
    const header = [
      "order_id",
      "delivered_at",
      "tutor_id",
      "tutor",
      "material",
      "gross_hkd",
      "platform_fee_hkd",
      "tutor_net_hkd",
    ].join(",");
    const lines = rows.map((r) =>
      [
        r.id,
        r.delivered_at,
        r.tutor_id,
        csvEscape(r.tutors?.display_name ?? ""),
        csvEscape(r.digital_materials?.title ?? ""),
        money(Number(r.gross_hkd)).toFixed(2),
        money(Number(r.platform_fee_hkd)).toFixed(2),
        money(Number(r.tutor_net_hkd)).toFixed(2),
      ].join(","),
    );
    const csv = [header, ...lines].join("\n");
    return {
      csv,
      rowCount: lines.length,
      fileName: `tutor-payouts-${new Date().toISOString().slice(0, 10)}.csv`,
    };
  });
