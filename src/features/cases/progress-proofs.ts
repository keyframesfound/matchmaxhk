/**
 * #794 §2.6 (was #730) — Report Card Checked, pure half.
 *
 * The desk verifies the document a case party attached to one progress
 * checkpoint, then destroys it. Everything that can be decided without I/O
 * lives here so vitest pins it and the server fns cannot drift:
 *
 *   - the private bucket, the 10 MB cap and the PDF/JPEG/PNG allowlist;
 *   - the object key shape `progress/<caseId>/<checkpointId>-<stamp>.<ext>`;
 *   - who may upload (a party on that case, never staff) and that an upload
 *     NEVER publishes — it stamps tutor_unconfirmed until the desk says so;
 *   - the decision: approve flips to desk_checked, reject reverts to
 *     tutor_unconfirmed, and BOTH null the key (PDPO: purge on decision, the
 *     raw document is never retained);
 *   - the 14-day sweep that discards an unreviewed upload (lazy call, no cron);
 *   - the staff gate — a non-admin plan is refused, not silently downgraded.
 *
 * Deliberately NOT here: bytes, Supabase calls, signed URLs.
 * (`progress-proofs.functions.ts`.)
 */

import type { VerificationKind } from "./progress-evidence";

// ---------------------------------------------------------------------------
// Bucket, cap, allowlist
// ---------------------------------------------------------------------------

/** Private bucket created by migration 20261124130000; service-role only. */
export const PROGRESS_PROOF_BUCKET = "progress-proofs";

/** 10 MB — hard cap per proof, mirrored by the bucket's `file_size_limit`. */
export const PROGRESS_PROOF_MAX_BYTES = 10 * 1024 * 1024;
export const PROGRESS_PROOF_MAX_MB = 10;
/** Base64 inflates by ~4/3; a 10 MB file is ~13.4M chars before padding. */
export const PROGRESS_PROOF_MAX_BASE64_LENGTH = 16_000_000;

/** PDF, JPEG, PNG. A report card is a document or a photo of one. */
export const PROGRESS_PROOF_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export type ProgressProofContentType = (typeof PROGRESS_PROOF_TYPES)[number];

/** An unreviewed upload is destroyed after this many days (lazy sweep). */
export const PROGRESS_PROOF_EXPIRY_DAYS = 14;

/** Signed read URL lifetime for staff — long enough to open a scan, no longer. */
export const PROGRESS_PROOF_SIGNED_URL_SECONDS = 600;

/** Staff note cap; matches `case_progress_checkpoints_proof_rejection_check`. */
export const PROGRESS_PROOF_NOTE_MAX = 500;

/**
 * Stored in `proof_rejection` when the desk refuses without a note, so a
 * non-null value always means "the evidence was not accepted" and the UI never
 * has to guess between "no note" and "never reviewed".
 */
export const PROGRESS_PROOF_REJECTION_FALLBACK = "rejected";

/** Stored in `proof_rejection` when the 14-day sweep discards an upload. */
export const PROGRESS_PROOF_EXPIRED_NOTE = "expired";

export type ProgressProofFileError = "FILE_TYPE" | "FILE_TOO_LARGE";

function normalizeContentType(contentType: string | null | undefined): string {
  return (contentType ?? "").toLowerCase().split(";")[0].trim();
}

/** Canonical type for a browser-supplied MIME string, or null when refused. */
export function normalizeProgressProofType(
  contentType: string | null | undefined,
): ProgressProofContentType | null {
  const type = normalizeContentType(contentType);
  // `image/jpg` is not the registered name but browsers still send it.
  const canonical = type === "image/jpg" ? "image/jpeg" : type;
  return (PROGRESS_PROOF_TYPES as readonly string[]).includes(canonical)
    ? (canonical as ProgressProofContentType)
    : null;
}

/** `pdf` | `jpg` | `png`, or null when the type is not accepted. */
export function progressProofExtension(
  contentType: string | null | undefined,
): "pdf" | "jpg" | "png" | null {
  const type = normalizeProgressProofType(contentType);
  if (type === "application/pdf") return "pdf";
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  return null;
}

/**
 * The stored byte count is what counts: the client's declared size is never
 * trusted. An empty file is not a readable proof either.
 */
export function progressProofFileError(input: {
  contentType: string | null | undefined;
  bytes: number;
}): ProgressProofFileError | null {
  if (!Number.isFinite(input.bytes) || input.bytes <= 0) return "FILE_TYPE";
  if (input.bytes > PROGRESS_PROOF_MAX_BYTES) return "FILE_TOO_LARGE";
  if (!normalizeProgressProofType(input.contentType)) return "FILE_TYPE";
  return null;
}

// ---------------------------------------------------------------------------
// Storage path
// ---------------------------------------------------------------------------

/** Ids arrive as uuids from zod; sanitise anyway so no path can climb out. */
function safeId(value: string): string {
  return (value ?? "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 64) || "unknown";
}

/**
 * `progress/<caseId>/<checkpointId>-<stamp>.<ext>` inside the private bucket.
 * The case folder is the ownership scope the server fn re-checks; the stamp
 * keeps a re-upload from overwriting the document a reviewer is opening.
 * Throws FILE_TYPE for a type the bucket does not take (callers validate first).
 */
export function progressProofPath(input: {
  caseId: string;
  checkpointId: string;
  contentType: string;
  now: number;
}): string {
  const ext = progressProofExtension(input.contentType);
  if (!ext) throw new Error("FILE_TYPE");
  const stamp = Number.isFinite(input.now) ? String(Math.trunc(input.now)) : "0";
  return `progress/${safeId(input.caseId)}/${safeId(input.checkpointId)}-${stamp}.${ext}`;
}

/** The folder a checkpoint's objects live in (case folder). */
export function progressProofFolder(caseId: string): string {
  return `progress/${safeId(caseId)}`;
}

/** File name prefix every upload for one checkpoint shares. */
export function progressProofNamePrefix(checkpointId: string): string {
  return `${safeId(checkpointId)}-`;
}

// ---------------------------------------------------------------------------
// Upload gate
// ---------------------------------------------------------------------------

export type ProgressProofSide = "parent" | "tutor" | "staff";

export type ProgressProofUploadPlan =
  | {
      ok: true;
      path: string;
      contentType: ProgressProofContentType;
      /** Always tutor_unconfirmed: an upload can never publish a checkpoint. */
      verification: "tutor_unconfirmed";
    }
  | { ok: false; reason: "FORBIDDEN" | "FILE_TYPE" | "FILE_TOO_LARGE" };

/**
 * Who may attach evidence: a party on that case, never the desk (staff review,
 * they do not supply the document). The checkpoint's author may always support
 * their own row; the case's parent may also support a tutor-entered row, since
 * the family is the data subject and the desk decides either way.
 */
export function planProgressProofUpload(input: {
  side: ProgressProofSide;
  authorSide: "parent" | "tutor";
  caseId: string;
  checkpointId: string;
  contentType: string;
  bytes: number;
  now?: number;
}): ProgressProofUploadPlan {
  if (input.side === "staff") return { ok: false, reason: "FORBIDDEN" };
  if (input.side !== input.authorSide && input.side !== "parent") {
    return { ok: false, reason: "FORBIDDEN" };
  }
  const fileError = progressProofFileError({
    contentType: input.contentType,
    bytes: input.bytes,
  });
  if (fileError) return { ok: false, reason: fileError };
  const type = normalizeProgressProofType(input.contentType);
  if (!type) return { ok: false, reason: "FILE_TYPE" };
  return {
    ok: true,
    path: progressProofPath({
      caseId: input.caseId,
      checkpointId: input.checkpointId,
      contentType: type,
      now: input.now ?? Date.now(),
    }),
    contentType: type,
    verification: "tutor_unconfirmed",
  };
}

// ---------------------------------------------------------------------------
// Desk decision
// ---------------------------------------------------------------------------

export type ProgressProofDecision = "approve" | "reject";

/** The columns the decision reads. `proof_key` is desk-only. */
export type ProgressProofRow = {
  verification: VerificationKind;
  proof_key: string | null;
  proof_uploaded_at: string | null;
  proof_reviewed_at: string | null;
};

export type ProgressProofUpdate = {
  verification: VerificationKind;
  /** Purged on every decision; a decided row never points at a document. */
  proof_key: null;
  proof_reviewed_by: string;
  proof_reviewed_at: string;
  proof_rejection: string | null;
};

export type ProgressProofReviewPlan =
  | {
      ok: true;
      /** Written to the row after the object is deleted. */
      update: ProgressProofUpdate;
      /** Object to delete; always the row's own key. */
      purgeKey: string;
      decision: ProgressProofDecision;
    }
  | { ok: false; reason: "FORBIDDEN" | "NOT_FOUND" | "NOT_PENDING" };

/**
 * Plan one desk decision.
 *  - non-admin → FORBIDDEN (the caller is refused, never quietly ignored);
 *  - no row → NOT_FOUND;
 *  - no live key (never uploaded, already decided, or already swept) →
 *    NOT_PENDING, which also makes a double decision a no-op;
 *  - approve → desk_checked, rejection cleared;
 *  - reject  → tutor_unconfirmed, the note (or the "rejected" marker) stored;
 *  - both    → proof_key nulled and the object purged.
 */
export function planProgressProofReview(input: {
  reviewerIsAdmin: boolean;
  reviewerId: string;
  row: ProgressProofRow | null;
  decision: ProgressProofDecision;
  note?: string | null;
  now?: Date;
}): ProgressProofReviewPlan {
  if (!input.reviewerIsAdmin) return { ok: false, reason: "FORBIDDEN" };
  const row = input.row;
  if (!row) return { ok: false, reason: "NOT_FOUND" };
  if (!row.proof_key) return { ok: false, reason: "NOT_PENDING" };

  const reviewedAt = (input.now ?? new Date()).toISOString();
  const note = (input.note ?? "").trim().slice(0, PROGRESS_PROOF_NOTE_MAX);
  const approved = input.decision === "approve";

  return {
    ok: true,
    decision: input.decision,
    purgeKey: row.proof_key,
    update: {
      verification: approved ? "desk_checked" : "tutor_unconfirmed",
      proof_key: null,
      proof_reviewed_by: input.reviewerId,
      proof_reviewed_at: reviewedAt,
      proof_rejection: approved ? null : note.length > 0 ? note : PROGRESS_PROOF_REJECTION_FALLBACK,
    },
  };
}

// ---------------------------------------------------------------------------
// Age + lazy sweep
// ---------------------------------------------------------------------------

/** Whole days since upload, floored at 0; a missing stamp reads as 0. */
export function progressProofAgeDays(uploadedAt: string | null, now: Date): number {
  if (!uploadedAt) return 0;
  const parsed = Date.parse(uploadedAt);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor((now.getTime() - parsed) / 86_400_000));
}

export type ProgressProofSweepRow = {
  id: string;
  proof_key: string | null;
  proof_uploaded_at: string | null;
  proof_reviewed_at: string | null;
};

export type ProgressProofSweepTarget = { id: string; purgeKey: string };

/**
 * A live, unreviewed upload older than the window is stale. A row that carries
 * a key but no upload stamp is treated as stale too — an unstamped pointer is
 * exactly the case the sweep exists for, not evidence to keep.
 */
export function isProgressProofExpired(
  row: ProgressProofSweepRow,
  now: Date,
  days: number = PROGRESS_PROOF_EXPIRY_DAYS,
): boolean {
  if (!row.proof_key || row.proof_reviewed_at) return false;
  if (!row.proof_uploaded_at) return true;
  const parsed = Date.parse(row.proof_uploaded_at);
  if (!Number.isFinite(parsed)) return true;
  return now.getTime() - parsed >= days * 86_400_000;
}

/** The rows one sweep pass must purge (each with the object to delete). */
export function planProgressProofSweep(
  rows: readonly ProgressProofSweepRow[],
  now: Date,
  days: number = PROGRESS_PROOF_EXPIRY_DAYS,
): ProgressProofSweepTarget[] {
  return rows
    .filter((row) => isProgressProofExpired(row, now, days))
    .map((row) => ({ id: row.id, purgeKey: row.proof_key as string }));
}

/**
 * What a swept row becomes: the claim reverts to unconfirmed, the pointer is
 * gone, and the reason records that the document expired rather than that a
 * reviewer refused it.
 */
export function expiredProgressProofUpdate(): {
  verification: "tutor_unconfirmed";
  proof_key: null;
  proof_rejection: string;
} {
  return {
    verification: "tutor_unconfirmed",
    proof_key: null,
    proof_rejection: PROGRESS_PROOF_EXPIRED_NOTE,
  };
}
