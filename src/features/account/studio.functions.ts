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

export type CreatorStudio = {
  inHoldHkd: number;
  availableHkd: number;
  totalPaidHkd: number;
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
    if (tutors[0]) {
      const held = await selectRows<{ tutor_net_hkd: number | string | null }>(
        db,
        "material_orders",
        "tutor_net_hkd",
        [
          { col: "tutor_id", op: "eq", value: tutors[0].id },
          { col: "status", op: "in", value: ["paid_held", "delivered_held"] },
        ],
      );
      inHoldHkd =
        Math.round(held.reduce((sum, r) => sum + (Number(r.tutor_net_hkd) || 0), 0) * 100) / 100;
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

    return { inHoldHkd, availableHkd, totalPaidHkd, referral };
  });
