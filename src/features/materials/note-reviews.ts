import { boughtListAction } from "@/features/materials/lifecycle";

/**
 * Notes upload v2: who may rate / comment and how ratings aggregate. Pure;
 * unit-tested in tests/materials/note-reviews.test.ts.
 */

export const REVIEW_COMMENT_MAX = 2000;

export type BuyerOrderLike = {
  status: string;
  refund_amount?: number | string | null;
  gross_hkd?: number | string | null;
};

/**
 * A buyer may review (and download extras) only while one of their orders
 * for the note grants file access: the same rule as the Bought list's
 * Download button (delivered / held / released, or a PARTIAL refund).
 */
export function orderGrantsNoteAccess(order: BuyerOrderLike): boolean {
  const refund = order.refund_amount == null ? null : Number(order.refund_amount);
  const gross = order.gross_hkd == null ? undefined : Number(order.gross_hkd);
  return boughtListAction(order.status, refund, gross) === "download";
}

export function anyOrderGrantsNoteAccess(orders: BuyerOrderLike[]): boolean {
  return orders.some(orderGrantsNoteAccess);
}

export type RatingSummary = {
  average: number | null;
  count: number;
  /** Count per star, index 0 = 1 star ... index 4 = 5 stars. */
  distribution: [number, number, number, number, number];
};

export function summarizeRatings(ratings: number[]): RatingSummary {
  const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let sum = 0;
  let count = 0;
  for (const raw of ratings) {
    const r = Math.round(Number(raw));
    if (r < 1 || r > 5) continue;
    distribution[r - 1] += 1;
    sum += r;
    count += 1;
  }
  return {
    average: count === 0 ? null : Math.round((sum / count) * 10) / 10,
    count,
    distribution,
  };
}
