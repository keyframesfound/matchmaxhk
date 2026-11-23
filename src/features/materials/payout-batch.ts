/**
 * #784 §2.2: the weekly Monday FPS payout run, as a pure preview.
 *
 * Staff need to see who is due before money moves: which sellers cleared the
 * HK$50 minimum, how much each is owed, and where it should be sent. This
 * module only computes — the batch write (ledger entries + batch record) is a
 * separate, explicitly-confirmed action.
 *
 * Balance is the signed sum of seller_balance_entries; payoutDueHkd() applies
 * the locked minimum, so a seller under HK$50 rolls over untouched.
 */

import { MIN_PAYOUT_HKD, payoutDueHkd } from "@/features/materials/marketplace-policy";

export type PayoutLedgerRow = { user_id: string; amount_hkd: number | string };
export type PayoutSeller = {
  user_id: string;
  display_name: string | null;
  tutor_code: string | null;
};
export type PayoutDetails = {
  user_id: string;
  payout_method: string | null;
  payee_name: string | null;
};

export type PayoutPreviewRow = {
  userId: string;
  sellerName: string;
  tutorCode: string | null;
  balanceHkd: number;
  dueHkd: number;
  method: string | null;
  payeeName: string | null;
  /** True when the balance is positive but under the HK$50 minimum. */
  belowMinimum: boolean;
  /** True when a due seller has no payout details on file. */
  missingDetails: boolean;
};

export type PayoutPreview = {
  rows: PayoutPreviewRow[];
  dueTotalHkd: number;
  dueCount: number;
  belowMinimumCount: number;
  missingDetailsCount: number;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Groups the ledger per seller, applies the payout rule, and orders the run
 * by amount owed (largest first) so the desk works the big ones first.
 * Sellers with a zero balance are omitted; negative balances are kept so a
 * carried offset stays visible.
 */
export function buildPayoutPreview(
  entries: readonly PayoutLedgerRow[],
  sellers: readonly PayoutSeller[],
  details: readonly PayoutDetails[],
): PayoutPreview {
  const balances = new Map<string, number>();
  for (const entry of entries) {
    const amount = Number(entry.amount_hkd) || 0;
    balances.set(entry.user_id, round2((balances.get(entry.user_id) ?? 0) + amount));
  }

  const sellerByUser = new Map(sellers.map((s) => [s.user_id, s]));
  const detailsByUser = new Map(details.map((d) => [d.user_id, d]));

  const rows: PayoutPreviewRow[] = [];
  for (const [userId, balanceHkd] of balances) {
    if (balanceHkd === 0) continue;
    const seller = sellerByUser.get(userId);
    const detail = detailsByUser.get(userId);
    const dueHkd = payoutDueHkd(balanceHkd);
    rows.push({
      userId,
      sellerName: seller?.display_name ?? "",
      tutorCode: seller?.tutor_code ?? null,
      balanceHkd,
      dueHkd,
      method: detail?.payout_method ?? null,
      payeeName: detail?.payee_name ?? null,
      belowMinimum: balanceHkd > 0 && dueHkd === 0,
      missingDetails: dueHkd > 0 && !detail,
    });
  }

  rows.sort((a, b) => b.dueHkd - a.dueHkd || b.balanceHkd - a.balanceHkd);

  return {
    rows,
    dueTotalHkd: round2(rows.reduce((sum, row) => sum + row.dueHkd, 0)),
    dueCount: rows.filter((row) => row.dueHkd > 0).length,
    belowMinimumCount: rows.filter((row) => row.belowMinimum).length,
    missingDetailsCount: rows.filter((row) => row.missingDetails).length,
  };
}

/** CSV for the ops transfer sheet: one line per seller actually being paid. */
export function payoutPreviewCsv(preview: PayoutPreview): string {
  const header = ["seller", "tutor_code", "method", "payee", "balance_hkd", "due_hkd"].join(",");
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = preview.rows
    .filter((row) => row.dueHkd > 0)
    .map((row) =>
      [
        escape(row.sellerName),
        escape(row.tutorCode ?? ""),
        escape(row.method ?? ""),
        escape(row.payeeName ?? ""),
        row.balanceHkd.toFixed(2),
        row.dueHkd.toFixed(2),
      ].join(","),
    );
  return [header, ...lines].join("\n");
}

export { MIN_PAYOUT_HKD };
