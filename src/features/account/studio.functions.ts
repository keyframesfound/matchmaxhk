import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows } from "@/features/cases/desk-db";

/**
 * Issue #585 — Creator & Account Studio data: the three payout buckets over
 * the #573 seller ledger + the #585 referral funnel from the existing
 * get_my_referral_dashboard RPC. Owner-only; no public analytics here.
 *
 *  - In Hold: net of orders still inside the 72h protection window.
 *  - Available: the signed seller_balance_entries sum (next weekly batch).
 *  - Total Paid: every payout entry already sent.
 */

/** #784 §2.2 / AC-543-6: one row of the seller's recent-sales ledger. */
export type SellerSale = {
  id: string;
  title: string;
  grossHkd: number;
  netHkd: number;
  status: string;
  /** Paid-and-held ends here; null once the order left escrow. */
  holdEndsAt: string | null;
  soldAt: string;
};

export type CreatorStudio = {
  inHoldHkd: number;
  availableHkd: number;
  totalPaidHkd: number;
  recentSales: SellerSale[];
  referral: {
    referralCode: string | null;
    friends: number;
    pendingHkd: number;
    readyHkd: number;
    paidHkd: number;
  } | null;
};

const centsToHkd = (cents: number | null | undefined) => Math.round(cents ?? 0) / 100;

export const getMyCreatorStudio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreatorStudio> => {
    const db = asAdminDb((await import("@/integrations/supabase/client.server")).supabaseAdmin);

    const entries = await selectRows<{ kind: string; amount_hkd: number | string }>(
      db,
      "seller_balance_entries",
      "kind, amount_hkd",
      [{ col: "user_id", op: "eq", value: context.userId }],
    );
    let availableHkd = 0;
    let totalPaidHkd = 0;
    for (const e of entries) {
      const amount = Number(e.amount_hkd) || 0;
      availableHkd += amount;
      if (e.kind === "payout") totalPaidHkd += -amount;
    }
    availableHkd = Math.round(availableHkd * 100) / 100;

    // In Hold = seller net of orders still inside the 72h window.
    const tutors = await selectRows<{ id: string }>(db, "tutors", "id", [
      { col: "user_id", op: "eq", value: context.userId },
    ]);
    let inHoldHkd = 0;
    let recentSales: SellerSale[] = [];
    if (tutors[0]) {
      const held = await selectRows<{ tutor_net_hkd: number | string | null }>(
        db,
        "material_orders",
        "tutor_net_hkd",
        [
          { col: "tutor_id", op: "eq", value: tutors[0].id },
          // #784: live FPS-cashier orders sit in "held"; Stripe ones in paid/delivered_held.
          { col: "status", op: "in", value: ["held", "paid_held", "delivered_held"] },
        ],
      );
      inHoldHkd =
        Math.round(held.reduce((sum, r) => sum + (Number(r.tutor_net_hkd) || 0), 0) * 100) / 100;

      // #784 §2.2: the recent earnings ledger the issue locks (notes sold,
      // hold remaining). Five rows is enough to orient without paginating.
      const sales = await selectRows<{
        id: string;
        gross_hkd: number | string | null;
        tutor_net_hkd: number | string | null;
        status: string;
        hold_expires_at: string | null;
        hold_until: string | null;
        paid_at: string | null;
        delivered_at: string | null;
        created_at: string;
        digital_materials: { title: string | null } | null;
      }>(
        db,
        "material_orders",
        "id, gross_hkd, tutor_net_hkd, status, hold_expires_at, hold_until, paid_at, delivered_at, created_at, digital_materials(title)",
        [
          { col: "tutor_id", op: "eq", value: tutors[0].id },
          // Grants are not sales; they never appear in the earnings ledger.
          { col: "is_grant", op: "eq", value: false },
        ],
        { col: "created_at", asc: false, limit: 5 },
      );
      recentSales = sales.map((s) => ({
        id: s.id,
        title: s.digital_materials?.title ?? "",
        grossHkd: Number(s.gross_hkd) || 0,
        netHkd: Number(s.tutor_net_hkd) || 0,
        status: s.status,
        holdEndsAt: s.hold_expires_at ?? s.hold_until ?? null,
        soldAt: s.delivered_at ?? s.paid_at ?? s.created_at,
      }));
    }

    // The RPC is SECURITY DEFINER on auth.uid() — call it as the user.
    const { data: referralRaw, error: referralError } = await context.supabase.rpc(
      "get_my_referral_dashboard",
    );
    let referral: CreatorStudio["referral"] = null;
    if (!referralError && referralRaw && typeof referralRaw === "object") {
      const payload = referralRaw as Record<string, unknown>;
      referral = {
        referralCode: typeof payload.referral_code === "string" ? payload.referral_code : null,
        friends: Number(payload.friends ?? 0),
        pendingHkd: centsToHkd(Number(payload.pending_cents ?? 0)),
        readyHkd: centsToHkd(Number(payload.ready_cents ?? 0)),
        paidHkd: centsToHkd(Number(payload.paid_cents ?? 0)),
      };
    }

    return { inHoldHkd, availableHkd, totalPaidHkd, recentSales, referral };
  });
