/**
 * #784 §2.2: staff view of the weekly Monday FPS payout run.
 *
 * Read-only on purpose. The locked policy pays every seller whose released
 * net is at least HK$50 every Monday; this returns who that is today, so the
 * desk can transfer and then record the batch. Writing the batch is a
 * separate, explicitly-confirmed action (money movement is never implicit).
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin, selectRows } from "@/features/cases/desk-db";
import { asAdminDb } from "@/features/materials/storage-helpers";
import {
  buildPayoutPreview,
  type PayoutDetails,
  type PayoutLedgerRow,
  type PayoutPreview,
  type PayoutSeller,
} from "@/features/materials/payout-batch";

export const getWeeklyPayoutPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PayoutPreview> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);

    const [entries, sellers, details] = await Promise.all([
      selectRows<PayoutLedgerRow>(db, "seller_balance_entries", "user_id, amount_hkd", []),
      selectRows<{
        user_id: string | null;
        display_name: string | null;
        tutor_code: string | null;
      }>(db, "tutors", "user_id, display_name, tutor_code", []),
      selectRows<PayoutDetails>(
        db,
        "seller_payout_details",
        "user_id, payout_method, payee_name",
        [],
      ),
    ]);

    const sellerRows: PayoutSeller[] = sellers
      .filter((row): row is PayoutSeller => Boolean(row.user_id))
      .map((row) => ({
        user_id: row.user_id as string,
        display_name: row.display_name,
        tutor_code: row.tutor_code,
      }));

    return buildPayoutPreview(entries, sellerRows, details);
  });
