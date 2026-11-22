/**
 * Issue #794 §2.3 (AC-560-1..AC-560-4) — Verified Need upload target, pure half.
 *
 * Everything the storage server fns and the (not-yet-written) family upload UI
 * must agree on lives here, vitest-covered: the private bucket name, the 10 MB
 * cap, the PDF/JPEG/PNG allowlist (a .zip is refused by name *and* by MIME), and
 * the object key scheme.
 *
 * Deliberately NOT here: bytes, Supabase calls and staff decisions
 * (need-verification.functions.ts).
 *
 * The key is `<userId>/<stamp>-<random>-<sanitisedName><ext>`. The folder is the
 * ownership scope: `submitNeedVerification` re-checks it, so one account can
 * never register bytes it uploaded into another account's folder. A proof of
 * need is a photo or a scan of one letter, never an archive: tutors have no
 * grant on the bucket and no server fn returns the object key to them.
 */

// ---------------------------------------------------------------------------
// Bucket, cap, allowlist
// ---------------------------------------------------------------------------

/** Private bucket created by migration 20261122230000; service-role only. */
export const NEED_VERIFICATION_BUCKET = "access-verification";

/** 10 MB — hard cap per proof, mirrored by the bucket's `file_size_limit`. */
export const NEED_VERIFICATION_MAX_BYTES = 10_485_760;
export const NEED_VERIFICATION_MAX_MB = 10;

/** PDF, JPEG, PNG. Anything else is refused before a byte is stored. */
export const NEED_VERIFICATION_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export type NeedVerificationType = (typeof NEED_VERIFICATION_TYPES)[number];

/**
 * Copy keys: `need_verification.err_<code>`. ZIP and empty files read as
 * FILE_TYPE on purpose — the only two keys that subtree carries, and "Use a PDF,
 * JPG or PNG." is the right instruction for both.
 */
export type NeedVerificationFileError = "FILE_TYPE" | "FILE_TOO_LARGE";

function normalizeType(contentType: string | null | undefined): string {
  return (contentType ?? "").toLowerCase().split(";")[0].trim();
}

export function needVerificationFileError(input: {
  name: string;
  contentType: string;
  size: number;
}): NeedVerificationFileError | null {
  const name = (input.name ?? "").trim().toLowerCase();
  const type = normalizeType(input.contentType);
  // A ZIP cannot be reviewed as one document, and the bucket does not take it,
  // so the archive refusal happens before the size check.
  if (
    name.endsWith(".zip") ||
    type === "application/zip" ||
    type === "application/x-zip-compressed"
  ) {
    return "FILE_TYPE";
  }
  // 1..10 MB. An empty or non-finite size is not a readable proof.
  if (!Number.isFinite(input.size) || input.size <= 0) return "FILE_TYPE";
  if (input.size > NEED_VERIFICATION_MAX_BYTES) return "FILE_TOO_LARGE";
  if (!(NEED_VERIFICATION_TYPES as readonly string[]).includes(type)) return "FILE_TYPE";
  return null;
}

// ---------------------------------------------------------------------------
// Storage path
// ---------------------------------------------------------------------------

/**
 * Whole key cap, suffix included. Storage paths are not user-visible, so the
 * name is cut far harder than the 200-char declaration limit.
 */
const MAX_PATH = 120;
const MAX_FOLDER = 64;
const MAX_SUFFIX = 16;
/** The extension is kept verbatim (lowercased), up to 10 characters. */
const MAX_EXT = 10;
const FALLBACK_BASE = "proof";

/** Code points, not code units: never cut a surrogate pair in half. */
function truncate(value: string, max: number): string {
  return Array.from(value).slice(0, Math.max(1, max)).join("");
}

/** Lowercased extension of the original name, or "" when it has none. */
function fileExtension(name: string): string {
  const match = new RegExp(`\\.([a-z0-9]{1,${MAX_EXT}})$`, "i").exec(name.trim());
  return match ? `.${match[1].toLowerCase()}` : "";
}

/**
 * One path segment: letters (any script), digits, dot, dash and underscore.
 * Every separator, control char and shell/URL metacharacter collapses, so
 * `../../etc/passwd.pdf` becomes `etc-passwd.pdf` and can never climb out of the
 * caller's folder. Repeated dots are collapsed too, so no `..` survives.
 */
function safeSegment(value: string, max: number): string {
  const cleaned = (value ?? "")
    .replace(/\p{Cc}/gu, "")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return truncate(cleaned, max).replace(/[-.]+$/g, "") || FALLBACK_BASE;
}

/**
 * `<userId>/<now>-<random>-<sanitisedName><ext>` in the private
 * `access-verification` bucket, capped so the whole key stays under ~120 chars.
 */
export function needVerificationPath(
  userId: string,
  name: string,
  now: number,
  random: string,
): string {
  const folder = safeSegment(userId, MAX_FOLDER);
  const stamp = Number.isFinite(now) ? String(Math.trunc(now)) : "0";
  const suffix = (random ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, MAX_SUFFIX) || "0";
  const ext = fileExtension(name ?? "");
  // The separators are the three "-"s joining folder/stamp/suffix/base.
  const budget = MAX_PATH - folder.length - stamp.length - suffix.length - ext.length - 3;
  const base = safeSegment(
    (name ?? "").replace(new RegExp(`\\.[a-z0-9]{1,${MAX_EXT}}$`, "i"), ""),
    budget,
  );
  return `${folder}/${stamp}-${suffix}-${base}${ext}`;
}

/**
 * The folder is the ownership scope: a submitted key must sit under the caller's
 * own folder and may not carry a traversal or a Windows separator.
 */
export function isOwnedNeedVerificationPath(userId: string, path: string): boolean {
  const folder = safeSegment(userId, MAX_FOLDER);
  return path.startsWith(`${folder}/`) && !path.includes("..") && !path.includes("\\");
}
