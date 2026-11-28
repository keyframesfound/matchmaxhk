/**
 * Issue #543 slice 1 — automated-checkout groundwork (no Stripe yet).
 *
 * The state machine this slice ships:
 *   paid_held            — set by the Stripe path (next slice) at
 *                          checkout.session.completed; paid_at + hold_expires_at
 *                          = paid_at + 72h are written then.
 *   disputed_frozen      — a dispute inside the window pauses auto-release.
 *   completed_released   — the hard cut-off; the Report button disappears and
 *                          the seller net moves to the weekly FPS batch.
 *
 * The release sweep is advisory (the #328/#429 no-cron-crash pattern) and
 * runs both from the hourly Nitro task and lazily from desk reads.
 * seller_payout_details is service-role only; sellers read/write their own
 * row through the server fns below.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { asAdminDb, type AdminDb } from "@/features/materials/storage-helpers";
import { selectRows } from "@/features/cases/desk-db";
import { shouldSkipRelease } from "@/features/materials/lifecycle";

/**
 * #672 replaces the flat 2% lock with tiered take rates — the percent is
 * resolved per order in startCheckout (5% verified tutor / 8% standard /
 * 12% courses & bundles) and snapshotted on material_orders.platform_fee_pct.
 * See src/features/cases/commission-protection.ts (MARKETPLACE_TAKE_RATES).
 */
export const CHECKOUT_HOLD_HOURS = 72;

/**
 * #784 §2.1/§2.2: a released Stripe order's seller net enters the seller
 * ledger (seller_balance_entries, kind sale_net) for the Monday FPS batch.
 * One row per order (partial unique index); a repeat sweep is a no-op.
 */
async function postSaleNetEntries(db: AdminDb, orderIds: string[]): Promise<void> {
  if (orderIds.length === 0) return;
  const orders = await selectRows<{
    id: string;
    tutor_id: string;
    tutor_net_hkd: number | string | null;
    seller_net_payout_hkd: number | string | null;
  }>(db, "material_orders", "id, tutor_id, tutor_net_hkd, seller_net_payout_hkd", [
    { col: "id", op: "in", value: orderIds },
  ]);
  const tutorIds = [...new Set(orders.map((o) => o.tutor_id))];
  const tutors = tutorIds.length
    ? await selectRows<{ id: string; user_id: string | null }>(db, "tutors", "id, user_id", [
        { col: "id", op: "in", value: tutorIds },
      ])
    : [];
  const owner = new Map(tutors.map((t) => [t.id, t.user_id]));
  for (const o of orders) {
    const userId = owner.get(o.tutor_id);
    const net = Number(o.seller_net_payout_hkd ?? o.tutor_net_hkd ?? 0);
    if (!userId || !(net > 0)) continue;
    const { error } = await db.from<never>("seller_balance_entries").insert({
      user_id: userId,
      order_id: o.id,
      kind: "sale_net",
      amount_hkd: net,
      note: "Released after the 72h hold",
    });
    if (error && !/duplicate|unique/i.test(error.message)) {
      console.warn("[checkout-v2] ledger entry failed:", error.message);
    }
  }
}

/**
 * Flip past-due paid_held orders to completed_released. Orders with an OPEN
 * dispute (dispute_status 'open' / 'seller_responded') are skipped: the
 * dispute freezes the release until staff resolve (#784 AC-543-4). The
 * dispute state lives on the order row itself, so no second table is read.
 * Advisory — never throws.
 */
export async function sweepCheckoutHolds(db: AdminDb): Promise<void> {
  try {
    const now = new Date().toISOString();
    const { data: due } = await db
      .from<{ id: string; dispute_status: string | null }>("material_orders")
      .select("id, dispute_status")
      .eq("status", "paid_held")
      .lte("hold_expires_at", now);
    const ids = (due ?? []).filter((row) => !shouldSkipRelease(row)).map((row) => row.id);
    if (ids.length === 0) return;
    await db
      .from<never>("material_orders")
      .update({
        status: "completed_released",
        released_at: now,
        released_reason: "checkout_hold_expired",
      })
      .in("id", ids);
    await postSaleNetEntries(db, ids);
  } catch {
    // Advisory: pre-migration env or a hiccup must not break the read.
  }
}

// ---------------------------------------------------------------------------
// Seller payout registration (#543 §A.5)
// ---------------------------------------------------------------------------

export type SellerPayoutDetails = {
  payoutMethod: "fps_phone" | "fps_id" | "bank_account";
  fpsPhone: string | null;
  fpsId: string | null;
  bankAccount: string | null;
  payeeName: string;
};

const PayoutInput = z
  .object({
    payoutMethod: z.enum(["fps_phone", "fps_id", "bank_account"]),
    fpsPhone: z
      .string()
      .trim()
      .regex(/^[2-9][0-9]{7}$/, "FPS phone must be an 8-digit HK number")
      .nullish(),
    fpsId: z.string().trim().max(30).nullish(),
    bankAccount: z.string().trim().min(8).max(24).nullish(),
    payeeName: z.string().trim().min(1).max(80),
  })
  .refine(
    (v) =>
      (v.payoutMethod === "fps_phone" && !!v.fpsPhone) ||
      (v.payoutMethod === "fps_id" && !!v.fpsId) ||
      (v.payoutMethod === "bank_account" && !!v.bankAccount),
    { message: "Enter the details for the chosen payout method" },
  );

export const saveMyPayoutDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) => PayoutInput.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const now = new Date().toISOString();
    const fields = {
      payout_method: data.payoutMethod,
      fps_phone: data.fpsPhone ?? null,
      fps_id: data.fpsId ?? null,
      bank_account: data.bankAccount ?? null,
      payee_name: data.payeeName,
      updated_at: now,
    };
    const { error } = await db
      .from("seller_payout_details")
      .upsert({ user_id: context.userId, ...fields });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyPayoutDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SellerPayoutDetails | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const rows = await selectRows<{
      payout_method: SellerPayoutDetails["payoutMethod"];
      fps_phone: string | null;
      fps_id: string | null;
      bank_account: string | null;
      payee_name: string;
    }>(db, "seller_payout_details", "*", [{ col: "user_id", op: "eq", value: context.userId }]);
    const row = rows[0];
    if (!row) return null;
    return {
      payoutMethod: row.payout_method,
      fpsPhone: row.fps_phone,
      fpsId: row.fps_id,
      bankAccount: row.bank_account,
      payeeName: row.payee_name,
    };
  });
