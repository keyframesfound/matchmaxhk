/**
 * #783 §2.4: a BYOS_DIRECT case (admin_fee_waived = true) never gets an
 * admin-fee row — not from the #760 auto-invoice, not from the desk. The
 * standard platform-matched fee is unchanged for every other case.
 */

import { selectRows, type Db } from "@/features/cases/desk-db";

export async function isAdminFeeWaived(db: Db, caseId: string): Promise<boolean> {
  const rows = await selectRows<{ admin_fee_waived: boolean | null }>(
    db,
    "tutoring_cases",
    "admin_fee_waived",
    [{ col: "id", op: "eq", value: caseId }],
  );
  return rows[0]?.admin_fee_waived === true;
}

/** Throws ADMIN_FEE_WAIVED_BYOS before any desk path writes a fee row. */
export async function assertAdminFeeNotWaived(db: Db, caseId: string): Promise<void> {
  if (await isAdminFeeWaived(db, caseId)) throw new Error("ADMIN_FEE_WAIVED_BYOS");
}
