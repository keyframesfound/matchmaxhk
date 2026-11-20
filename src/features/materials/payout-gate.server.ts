/**
 * #784 §2.2 (AC-585-1): a seller must register private HK payout details
 * before a PAID listing can be submitted. Free (HK$0) listings never need
 * them. Details stay service-role only (seller_payout_details).
 */

import { selectRows, type Db } from "@/features/cases/desk-db";

export const PAYOUT_DETAILS_REQUIRED_MESSAGE =
  "Add your payout details (FPS or bank account) in Creator Studio before listing a paid item. Free listings don't need them. / 刊登收費項目前，請先在 Creator Studio 填寫收款資料（轉數快或銀行戶口）。免費項目則不需要。";

export async function assertPayoutDetailsForPaidListing(
  db: Db,
  userId: string,
  priceHkd: number,
): Promise<void> {
  if (!(priceHkd > 0)) return;
  const rows = await selectRows<{ user_id: string }>(db, "seller_payout_details", "user_id", [
    { col: "user_id", op: "eq", value: userId },
  ]);
  if (rows.length === 0) throw new Error(PAYOUT_DETAILS_REQUIRED_MESSAGE);
}
