/**
 * Issue #259 (O1) — Fee desk, pure half.
 *
 * The payer (the matched tutor, tutor-pays lock #444 / #464) sees the invoice
 * and the company FPS details on their case card, may attach ONE payment
 * screenshot, and staff mark paid. Everything decidable without a DB lives
 * here so vitest pins the rules:
 *   * the FPS reference is the case code (MM-{{case_code}} in the memo)
 *   * a reference already used to close another case is rejected
 *   * screenshots are JPEG / PNG only, max 5 MB
 *   * payments are marked on HK working days; a screenshot after 18:00 HKT
 *     (or on a weekend) is marked the next working day
 */

/** Company FPS payee (CEO lock, #454 §3). Shown to the payer and in /fps. */
export const MATCHMAX_FPS = {
  payeeName: "Chan Hau Yui",
  fpsNumber: "6199-1509",
  bankAccount: "HSBC 563-440361-833",
} as const;

export const FEE_SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
export const FEE_SCREENSHOT_TYPES = ["image/jpeg", "image/png"] as const;
export type FeeScreenshotType = (typeof FEE_SCREENSHOT_TYPES)[number];

/** Payments received after this HKT hour are marked the next working day. */
export const FEE_MARKING_CUTOFF_HOUR_HKT = 18;
const HKT_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The memo the payer types: "MM-" + the case code (C-1234 → MM-C-1234). */
export function fpsMemoForCase(caseCode: string): string {
  const code = caseCode.trim().toUpperCase();
  return code.startsWith("MM-") ? code : `MM-${code}`;
}

/**
 * Canonical form used to compare bank references across cases: upper case,
 * no whitespace, no leading "MM-" so "mm-c-12" and "C-12" collide.
 */
export function normalizeFpsReference(raw: string | null | undefined): string | null {
  const compact = (raw ?? "").replace(/\s+/g, "").toUpperCase();
  const bare = compact.startsWith("MM-") ? compact.slice(3) : compact;
  return bare.length >= 3 ? bare : null;
}

export type PaidReference = { caseId: string; fpsReference: string | null };

/**
 * #259 acceptance: "The same FPS reference cannot close two cases." True when
 * `reference` already closed a fee on a DIFFERENT case.
 */
export function isReferenceUsedElsewhere(
  reference: string | null | undefined,
  caseId: string,
  paid: readonly PaidReference[],
): boolean {
  const key = normalizeFpsReference(reference);
  if (!key) return false;
  return paid.some((p) => p.caseId !== caseId && normalizeFpsReference(p.fpsReference) === key);
}

export function isAllowedScreenshot(contentType: string, byteLength: number): boolean {
  return (
    (FEE_SCREENSHOT_TYPES as readonly string[]).includes(contentType) &&
    byteLength > 0 &&
    byteLength <= FEE_SCREENSHOT_MAX_BYTES
  );
}

function hktParts(d: Date): { y: number; m: number; day: number; hour: number; dow: number } {
  const h = new Date(d.getTime() + HKT_OFFSET_MS);
  return {
    y: h.getUTCFullYear(),
    m: h.getUTCMonth(),
    day: h.getUTCDate(),
    hour: h.getUTCHours(),
    dow: h.getUTCDay(),
  };
}

/**
 * The HKT calendar date (YYYY-MM-DD) staff will mark a payment received at
 * `receivedAt`: same day before 18:00 on Mon–Fri, else the next weekday.
 * Public holidays are not modelled (desk handles them by hand).
 */
export function expectedMarkingDateHkt(receivedAt: Date): string {
  const p = hktParts(receivedAt);
  let cursor = Date.UTC(p.y, p.m, p.day);
  const isWeekend = (dow: number) => dow === 0 || dow === 6;
  if (p.hour >= FEE_MARKING_CUTOFF_HOUR_HKT || isWeekend(p.dow)) {
    cursor += DAY_MS;
    while (isWeekend(new Date(cursor).getUTCDay())) cursor += DAY_MS;
  }
  return new Date(cursor).toISOString().slice(0, 10);
}
