/**
 * Issues #203 + P8 (#288) + P9 (#289): pure helpers for the notes
 * marketplace lifecycle. Everything here is deliberately free of Supabase /
 * TanStack imports so the vitest suite can exercise the status machine,
 * validation and money rules directly (server fns are not testable
 * end-to-end — see tests/materials/orders.test.ts for the precedent).
 */

/** #203 listing status machine. */
export const MATERIAL_STATUSES = [
  "draft",
  "pending_review",
  "published",
  "hidden",
  "rejected",
] as const;

export type MaterialStatus = (typeof MATERIAL_STATUSES)[number];

/** Fields the owner may always edit (P8 "after publish" list + P9). */
export const OWNER_EDITABLE_FIELDS = ["title", "price", "description"] as const;

/** #203 price floor; below this needs an admin (admins bypass server-side). */
export const MIN_PRICE_HKD = 30;

/** #203 file rules. */
export const MAX_PDF_BYTES = 20 * 1024 * 1024; // repo upload cap (issue allows 40MB; Workers body limits win)

/** P8: pages shown before the blur starts on the note page. */
export const CRISP_PREVIEW_PAGES = 3;

/**
 * Extended preview length (Ryan, 2026-10-11): roughly 30% of the document,
 * clamped to [5, 12] pages — enough to blur meaningfully like Clastify,
 * cheap enough to stamp at upload.
 */
export function extendedPreviewPageLimit(pageCount: number): number {
  const total = Math.max(1, Math.floor(pageCount));
  const thirtyPercent = Math.ceil(total * 0.3);
  return Math.min(12, Math.max(5, thirtyPercent));
}

export type SubmitCheckResult = {
  ok: boolean;
  /** i18n keys under notes.errors for each missing/invalid field (P8: "say which"). */
  missing: string[];
};

/**
 * P8 required-before-submit gate: title, price, PDF. (The sample images are
 * auto-generated from the PDF at upload, so they are never a tutor duty.)
 */
export function checkSubmitReadiness(input: {
  title?: string | null;
  priceHkd?: number | null;
  hasPdf: boolean;
}): SubmitCheckResult {
  const missing: string[] = [];
  if (!input.title || input.title.trim().length < 3) missing.push("title");
  if (input.priceHkd == null || Number.isNaN(input.priceHkd) || input.priceHkd < MIN_PRICE_HKD) {
    missing.push("price");
  }
  if (!input.hasPdf) missing.push("pdf");
  return { ok: missing.length === 0, missing };
}

/** P8: "An encrypted PDF is rejected. The reason is 'upload an unlocked file.'" */
export const ENCRYPTED_PDF_ERROR =
  "This PDF is password-protected. Please upload an unlocked file.";

/**
 * Heuristic PDF-encryption probe used BEFORE pdf-lib parsing: an encrypted
 * PDF's raw trailer carries /Encrypt. The authoritative check happens at
 * PDFDocument.load in the upload pipeline; this keeps the client-side
 * pre-submit message instant.
 */
export function looksLikeEncryptedPdf(bytes: Uint8Array): boolean {
  const marker = "Encrypt";
  const ascii: string[] = [];
  const window = bytes.subarray(0, Math.min(bytes.byteLength, 8192));
  for (let i = 0; i < window.length; i += 1) ascii.push(String.fromCharCode(window[i]));
  // Also scan the tail where the trailer lives.
  const tail: string[] = [];
  const tailStart = Math.max(0, bytes.byteLength - 2048);
  const tailWindow = bytes.subarray(tailStart);
  for (let i = 0; i < tailWindow.length; i += 1) tail.push(String.fromCharCode(tailWindow[i]));
  return ascii.join("").includes(marker) || tail.join("").includes(marker);
}

/** Money model (#203): platform_fee = round(gross × 0.20), net = gross − fee. */
export function splitMaterialMoney(grossHkd: number): {
  platformFeeHkd: number;
  tutorNetHkd: number;
} {
  const gross = Math.round(grossHkd * 100) / 100;
  const platformFeeHkd = Math.round(gross * 0.2 * 100) / 100;
  return { platformFeeHkd, tutorNetHkd: Math.round((gross - platformFeeHkd) * 100) / 100 };
}

/**
 * Short human order reference (#203: "the order id as the reference").
 * MM- prefix + Crockford-ish base32 of the timestamp + 3 random chars —
 * readable over WhatsApp, unique in practice, and retried on collision by
 * the caller.
 */
export function buildOrderReference(now: number = Date.now(), rand = Math.random): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let stamp = "";
  let n = Math.floor(now / 1000);
  while (stamp.length < 7) {
    stamp = alphabet[n % alphabet.length] + stamp;
    n = Math.floor(n / alphabet.length);
  }
  let tail = "";
  for (let i = 0; i < 3; i += 1) {
    tail += alphabet[Math.floor(rand() * alphabet.length)];
  }
  return `MM-${stamp}${tail}`;
}

/** URL-safe listing slug (P8 publish step): "IB Physics HL — Waves" → ib-physics-hl-waves. */
export function buildMaterialSlug(title: string, suffix?: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60)
    .replace(/-+$/g, "");
  const tail = suffix ? `-${suffix.toLowerCase()}` : "";
  return `${base || "note"}${tail}`;
}

export type StatusTransition =
  | "submit" // draft|rejected -> pending_review (P8)
  | "approve" // pending_review -> published (staff)
  | "reject" // pending_review -> rejected (staff, reason stored)
  | "hide" // published|hidden -> hidden (owner or staff)
  | "unhide" // hidden -> published
  | "unpublish"; // published -> draft (owner pulls it)

/** P8/P9 status machine. Returns the next status, or null when illegal. */
export function nextStatus(
  current: MaterialStatus,
  action: StatusTransition,
): MaterialStatus | null {
  switch (action) {
    case "submit":
      return current === "draft" || current === "rejected" ? "pending_review" : null;
    case "approve":
      return current === "pending_review" ? "published" : null;
    case "reject":
      return current === "pending_review" ? "rejected" : null;
    case "hide":
      return current === "published" || current === "hidden" ? "hidden" : null;
    case "unhide":
      return current === "hidden" ? "published" : null;
    case "unpublish":
      return current === "published" ? "draft" : null;
    default:
      return null;
  }
}

/** P9: which owner edit triggers a new staff review, and which go live. */
export function classifyOwnerEdit(delta: {
  titleChanged: boolean;
  priceChanged: boolean;
  descriptionChanged: boolean;
  pdfReplaced: boolean;
}): { needsReview: boolean; liveFields: string[] } {
  return {
    needsReview: delta.pdfReplaced,
    liveFields: [
      ...(delta.titleChanged ? ["title"] : []),
      ...(delta.priceChanged ? ["price"] : []),
      ...(delta.descriptionChanged ? ["description"] : []),
    ],
  };
}

/** #203/P13: which statuses keep buyer access (Bought list shows Download). */
export function orderGrantsAccess(status: string): boolean {
  return status === "delivered";
}

/** P13: refunded orders stay in the Bought list, labelled, without Download. */
export function boughtListAction(status: string): "download" | "refunded" | "preparing" {
  if (status === "delivered") return "download";
  if (status === "refunded") return "refunded";
  return "preparing";
}

/**
 * P12/P8: which listing events ring a bell in this PR. Only delivery does
 * (buyer + tutor) — the #205 event bus owns everything else later.
 */
export const BELL_EVENTS_IN_PR = ["material_order.delivered"] as const;
