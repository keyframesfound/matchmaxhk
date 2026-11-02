/**
 * #573 Notes Marketplace Master SoT: the locked numbers and rules, as pure
 * functions shared by the upload form, checkout, disputes, payouts and the
 * staff desk. Unit-tested in tests/materials/marketplace-policy.test.ts.
 *
 * Option A (seller net deduction): the buyer pays exactly the listed price;
 * the seller bears the 2% MatchMax platform fee AND the actual payment
 * gateway fee. D10 (cooling-off courtesy refund) is removed entirely.
 */

/**
 * Launch switch for everything buyer- or seller-visible that depends on the
 * #543 Stripe checkout: the Option A fee copy, the earnings calculator, the
 * no-cooling-off checkout acknowledgement, the new Notes Marketplace Terms
 * and auto-publish of clean uploads. The live notes flow is still the FPS
 * cashier (20%), so publishing 2% / 72h-from-payment terms before Stripe
 * ships would misstate the contract. Flip to true in the Stripe slice.
 */
export const NOTES_OPTION_A_LIVE = false;

/**
 * Copy keys that change at launch: `key` today, `notes_option_a.<swap>` once
 * NOTES_OPTION_A_LIVE is on. One table, so the launch is a one-line flip.
 */
export const OPTION_A_COPY = {
  "guide.notes.s3_title": "notes_option_a.guide_s3_title",
  "guide.notes.s3_body": "notes_option_a.guide_s3_body",
  "guide.notes.s5_title": "notes_option_a.guide_s5_title",
  "guide.notes.s5_body": "notes_option_a.guide_s5_body",
  "materials.disclaimer": "notes_option_a.disclaimer",
  "materials.legal_checkbox": "notes_option_a.legal_checkbox",
  "hiw.billing_faq.notes.a": "notes_option_a.billing_notes_a",
  "tour.tutor.shop_body": "notes_option_a.tour_shop",
  "notes.shop_terms_ack": "notes_option_a.no_cooling_off",
} as const;

export function optionACopyKey(key: string, live: boolean = NOTES_OPTION_A_LIVE): string {
  if (!live) return key;
  return (OPTION_A_COPY as Record<string, string>)[key] ?? key;
}

/**
 * Launch rate: 2% for the first 6 months or until cumulative materials GMV
 * reaches HK$50,000, whichever comes first; any later change needs 30 days'
 * notice to active sellers (#573).
 */
export const PLATFORM_FEE_RATE = 0.02;
export const FEE_REVIEW_GMV_HKD = 50_000;
export const FEE_REVIEW_MONTHS = 6;
export const FEE_CHANGE_NOTICE_DAYS = 30;

/** Paid listings: HK$20 to HK$5,000. HK$0 (free) is the only exception. */
export const MIN_PAID_PRICE_HKD = 20;
export const MAX_PRICE_HKD = 5_000;
/** #556: marking services start at HK$50. */
export const MIN_MARKING_PRICE_HKD = 50;

/** Monthly payout runs once a seller's released net balance reaches HK$50. */
export const MIN_PAYOUT_HKD = 50;
/** Any single refund or payout adjustment at or above this needs Ops Manager sign-off. */
export const MANAGER_APPROVAL_HKD = 500;
/** Protection hold: paid_at + 72h (notes) or delivered_at + 72h (marking). */
export const HOLD_HOURS = 72;
/** Seller window to reply / repair after a dispute opens. */
export const SELLER_REPLY_HOURS = 48;
/** D7: a buyer offered a partial refund must accept within 24h, else full refund. */
export const PARTIAL_REFUND_ACCEPT_HOURS = 24;

/**
 * Card estimate for the seller earnings calculator (Stripe HK cards /
 * Apple Pay: ~3.4% + HK$2.35). Always labelled an ESTIMATE: the real fee
 * comes from Stripe balance_transaction.fee and is lower for AlipayHK / FPS.
 */
export const EST_GATEWAY_RATE = 0.034;
export const EST_GATEWAY_FIXED_HKD = 2.35;

const cents = (value: number) => Math.round(value * 100) / 100;

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

export type PriceProblem = "negative" | "below_minimum" | "above_maximum" | "not_whole_cents";

/** Validate a listing price: 0, or HK$20 (HK$50 marking) to HK$5,000. */
export function validateListingPrice(
  priceHkd: number,
  materialType: string = "notes",
): PriceProblem | null {
  if (!Number.isFinite(priceHkd) || priceHkd < 0) return "negative";
  if (Math.abs(cents(priceHkd) - priceHkd) > 1e-9) return "not_whole_cents";
  if (priceHkd === 0) return null;
  const floor = materialType === "marking_service" ? MIN_MARKING_PRICE_HKD : MIN_PAID_PRICE_HKD;
  if (priceHkd < floor) return "below_minimum";
  if (priceHkd > MAX_PRICE_HKD) return "above_maximum";
  return null;
}

/** ROUND(gross * 0.02, 2). */
export function platformFeeHkd(grossHkd: number, rate: number = PLATFORM_FEE_RATE): number {
  return cents(grossHkd * rate);
}

/** Card-rate gateway fee ESTIMATE for the calculator (0 for free items). */
export function estimateGatewayFeeHkd(grossHkd: number): number {
  if (grossHkd <= 0) return 0;
  return cents(grossHkd * EST_GATEWAY_RATE + EST_GATEWAY_FIXED_HKD);
}

/** Option A seller net: gross - 2% platform fee - actual gateway fee. */
export function sellerNetPayoutHkd(
  grossHkd: number,
  gatewayFeeHkd: number,
  rate: number = PLATFORM_FEE_RATE,
): number {
  return cents(grossHkd - platformFeeHkd(grossHkd, rate) - gatewayFeeHkd);
}

/** The upload form's live calculator lines. */
export function earningsEstimate(grossHkd: number) {
  const gross = cents(Math.max(0, grossHkd));
  const platform = platformFeeHkd(gross);
  const gateway = estimateGatewayFeeHkd(gross);
  return { gross, platform, gateway, net: cents(gross - platform - gateway) };
}

/** Stripe reports the fee in cents on balance_transaction.fee. */
export function gatewayFeeFromStripeCents(feeCents: number): number {
  return cents(feeCents / 100);
}

// ---------------------------------------------------------------------------
// Disputes and refunds (D1-D9; D10 removed by #573)
// ---------------------------------------------------------------------------

export const DISPUTE_CODES = ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9"] as const;
export type DisputeCode = (typeof DISPUTE_CODES)[number];

/** D1-D8 are seller fault; D9 (duplicate purchase) is buyer-side. */
export function isSellerFault(code: DisputeCode): boolean {
  return code !== "D9";
}

/** D6 / D7 give the seller 48h to repair before a refund is due. */
export function allowsSellerRepair(code: DisputeCode): boolean {
  return code === "D6" || code === "D7";
}

export function isDisputeCode(value: unknown): value is DisputeCode {
  return typeof value === "string" && (DISPUTE_CODES as readonly string[]).includes(value);
}

export type RefundPlan = {
  /** Order status after the refund. */
  status: "refunded_full" | "refunded_less_fees";
  /** What goes back to the buyer. */
  buyerRefundHkd: number;
  /**
   * Debit recorded against the seller's balance (negative balance offset):
   * the non-refundable gateway fee (+ any bank chargeback fee) on seller
   * fault. 0 for D9 (the buyer bears the gateway fee).
   */
  sellerOffsetHkd: number;
  /** MatchMax keeps / returns nothing out of pocket. */
  requiresManagerApproval: boolean;
};

/**
 * Money plan for an APPROVED dispute on a still-held order (Option A):
 *  - D1-D8 (seller fault): buyer gets 100% of the gross; the gateway fee
 *    Stripe keeps becomes a negative-balance offset on the seller.
 *  - D9 (duplicate): buyer gets gross - gateway fee; no seller offset.
 * The seller's net on a refunded order is never credited.
 */
export function planRefund(input: {
  code: DisputeCode;
  grossHkd: number;
  gatewayFeeHkd: number;
  chargebackFeeHkd?: number;
}): RefundPlan {
  const gross = cents(input.grossHkd);
  const gateway = cents(Math.max(0, input.gatewayFeeHkd));
  const requiresManagerApproval = gross >= MANAGER_APPROVAL_HKD;
  if (input.code === "D9") {
    return {
      status: "refunded_less_fees",
      buyerRefundHkd: cents(Math.max(0, gross - gateway)),
      sellerOffsetHkd: 0,
      requiresManagerApproval,
    };
  }
  return {
    status: "refunded_full",
    buyerRefundHkd: gross,
    sellerOffsetHkd: cents(gateway + Math.max(0, input.chargebackFeeHkd ?? 0)),
    requiresManagerApproval,
  };
}

/** Golden rule: money moves only while the order is still held. */
export const HELD_STATUSES = ["paid_held", "delivered_held", "disputed_frozen"] as const;

export function canRefund(status: string): boolean {
  return (HELD_STATUSES as readonly string[]).includes(status);
}

/** Buyers may open a dispute only while held and before hold_expires_at. */
export function canOpenDispute(
  order: { status: string; hold_expires_at: string | null },
  now: Date = new Date(),
): boolean {
  if (order.status !== "paid_held" && order.status !== "delivered_held") return false;
  if (!order.hold_expires_at) return false;
  return now.getTime() < new Date(order.hold_expires_at).getTime();
}

/** D9 guard: the buyer must hold another paid order for the same listing. */
export function hasDuplicatePurchase(
  orders: { id: string; material_id: string; status: string }[],
  current: { id: string; material_id: string },
): boolean {
  const paid = new Set([...HELD_STATUSES, "completed_released"]);
  return orders.some(
    (o) => o.id !== current.id && o.material_id === current.material_id && paid.has(o.status),
  );
}

// ---------------------------------------------------------------------------
// Payouts and the seller balance ledger
// ---------------------------------------------------------------------------

export type LedgerEntry = {
  kind: "sale_net" | "refund_offset" | "chargeback_offset" | "payout" | "adjustment";
  /** Signed HKD: sale_net > 0, offsets and payouts < 0. */
  amountHkd: number;
};

/** Available balance = sum of the signed ledger (can go negative). */
export function availableBalanceHkd(entries: LedgerEntry[]): number {
  return cents(entries.reduce((sum, e) => sum + e.amountHkd, 0));
}

/** Monthly run pays the whole balance once it reaches HK$50 (or on closure). */
export function payoutDueHkd(balanceHkd: number, accountClosing = false): number {
  if (balanceHkd <= 0) return 0;
  if (accountClosing) return cents(balanceHkd);
  return balanceHkd >= MIN_PAYOUT_HKD ? cents(balanceHkd) : 0;
}

// ---------------------------------------------------------------------------
// Automated upload scanner (#573: clean -> live, flagged -> staff queue)
// ---------------------------------------------------------------------------

export type ScanFlag =
  | "exam_authority"
  | "marking_scheme"
  | "past_paper"
  | "school_internal"
  | "contact_details"
  | "payment_handle"
  | "no_text_layer";

const SCAN_RULES: { flag: ScanFlag; pattern: RegExp }[] = [
  {
    flag: "exam_authority",
    pattern:
      /\b(hkeaa|ibo|cambridge assessment|cie|edexcel|pearson edexcel|college board)\b|香港考試及評核局|考評局|考试及评核局|考评局/i,
  },
  {
    flag: "marking_scheme",
    pattern: /marking\s*scheme|mark\s*scheme|markscheme|評卷參考|评卷参考|評分準則/i,
  },
  {
    flag: "past_paper",
    pattern: /past\s*papers?|歷屆試題|历届试题|ib\s*official|official\s*paper/i,
  },
  {
    flag: "school_internal",
    pattern: /internal\s*exam|school\s*(?:exam|test)\s*paper|校內試卷|校内试卷|校內考試|校内考试/i,
  },
  {
    flag: "contact_details",
    pattern:
      /whats\s*app|wechat|微信|signal|telegram|\bigs?\b\s*[:@]|instagram|(?:\+?852[\s-]?)?\b[2-9]\d{3}[\s-]?\d{4}\b|[\w.+-]+@[\w-]+\.[a-z]{2,}/i,
  },
  { flag: "payment_handle", pattern: /payme|alipay\s*hk|轉數快|转数快|\bfps\b\s*(?:id|:)/i },
];

/**
 * Scan a listing's text (title, description, summary, tags) plus the PDF
 * text the browser extracted. A file with no usable text layer (scans,
 * photos) cannot be checked for QR codes or contact details, so it is
 * flagged `no_text_layer` and goes to the staff queue.
 */
export function scanListing(input: {
  listingText: string;
  fileText: string | null;
  hasFile: boolean;
}): ScanFlag[] {
  const flags = new Set<ScanFlag>();
  const haystack = `${input.listingText}\n${input.fileText ?? ""}`;
  for (const rule of SCAN_RULES) if (rule.pattern.test(haystack)) flags.add(rule.flag);
  if (input.hasFile && (input.fileText ?? "").replace(/\s+/g, "").length < 200) {
    flags.add("no_text_layer");
  }
  return Array.from(flags);
}

// ---------------------------------------------------------------------------
// Buyer watermark (#573: "Licensed to [masked email] - Order #[ID]")
// ---------------------------------------------------------------------------

/** j***@g***.com: first letter of the local part and of the domain name. */
export function maskEmail(email: string | null | undefined): string | null {
  const value = (email ?? "").trim();
  const at = value.lastIndexOf("@");
  if (at < 1 || at === value.length - 1) return null;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  const name = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  return `${local[0]}***@${name[0]}***${tld}`;
}

export function deliveredFooterText(input: {
  orderRef: string;
  buyerEmail?: string | null;
  buyerAccountId: string;
}): string {
  const masked = maskEmail(input.buyerEmail);
  const who = masked ?? `account ${input.buyerAccountId.slice(0, 8)}`;
  return `Licensed to ${who} · Order #${input.orderRef} · One student only · matchmax.hk`;
}

// ---------------------------------------------------------------------------
// Report triage (SOP §4.1, #573: P1 auto-hide at 3 open reports)
// ---------------------------------------------------------------------------

/** Report reasons that are P1 for notes listings (24h, interim hide). */
export const P1_REPORT_REASONS = ["copyright", "contact_details", "impersonation"] as const;
export const P1_AUTO_HIDE_OPEN_REPORTS = 3;

export function isP1ReportReason(reason: string): boolean {
  return (P1_REPORT_REASONS as readonly string[]).includes(reason);
}

/** Hide a published listing once it has this many open P1 reports. */
export function shouldAutoHideListing(openP1Reports: number): boolean {
  return openP1Reports >= P1_AUTO_HIDE_OPEN_REPORTS;
}
