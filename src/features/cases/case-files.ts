/**
 * Issue #785 AC-CONV-5 — case file uploads, pure half.
 *
 * Everything the storage server fns and the Case Workspace "Files" modal must
 * agree on lives here (vitest-covered): the 50 MB cap, the type allowlist, the
 * .zip refusal (ZIP archives cannot be scanned, so the UI asks for a link
 * instead), the storage path scheme and the four category buckets.
 *
 * Deliberately NOT here: byte handling and Supabase calls (case-files.functions.ts).
 * The 50 MB cap is this module's own and is independent of the #796 5 MB
 * mistake-book image cap — never borrow one for the other.
 */

// ---------------------------------------------------------------------------
// Cap and allowlist
// ---------------------------------------------------------------------------

/** 50 MB — hard cap per case file, mirrored by the `case-files` bucket limit. */
export const CASE_FILE_MAX_BYTES = 52_428_800;
export const CASE_FILE_MAX_MB = 50;

/**
 * PDF, JPEG, PNG, DOCX, PPTX. Anything else (ZIP, RAR, EXE, video…) is refused
 * by `caseFileError` before a byte is stored.
 */
export const CASE_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;
export type CaseFileType = (typeof CASE_FILE_TYPES)[number];

/** Copy keys: case_files.err_<code>. */
export type CaseFileError = "FILE_ZIP" | "FILE_TOO_LARGE" | "FILE_TYPE" | "FILE_EMPTY";

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const CASE_FILE_CATEGORIES = ["general", "pre_class", "homework", "post_class"] as const;
export type CaseFileCategory = (typeof CASE_FILE_CATEGORIES)[number];

export function isCaseFileCategory(v: unknown): v is CaseFileCategory {
  return typeof v === "string" && (CASE_FILE_CATEGORIES as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// Validation (client mirrors this for instant feedback; the server is the gate)
// ---------------------------------------------------------------------------

function normalizeType(contentType: string | null | undefined): string {
  return (contentType ?? "").toLowerCase().split(";")[0].trim();
}

/**
 * ZIP wins over everything: a `.zip` name or a ZIP MIME produces FILE_ZIP even
 * when the file is also oversized or the MIME is unknown, because "share a
 * link instead" is the actionable copy, not "compress it".
 */
export function caseFileError(input: {
  name: string;
  contentType: string;
  size: number;
}): CaseFileError | null {
  const name = (input.name ?? "").trim().toLowerCase();
  const type = normalizeType(input.contentType);
  if (
    name.endsWith(".zip") ||
    type === "application/zip" ||
    type === "application/x-zip-compressed"
  ) {
    return "FILE_ZIP";
  }
  if (!Number.isFinite(input.size) || input.size <= 0) return "FILE_EMPTY";
  if (input.size > CASE_FILE_MAX_BYTES) return "FILE_TOO_LARGE";
  if (!(CASE_FILE_TYPES as readonly string[]).includes(type)) return "FILE_TYPE";
  return null;
}

// ---------------------------------------------------------------------------
// Storage path
// ---------------------------------------------------------------------------

/** Stored file name cap, suffix included — long names (and CJK names) are cut. */
const MAX_STORED_NAME = 120;

/** Lowercased extension of the original name, or "" when it has none. */
function fileExtension(name: string): string {
  const match = /\.([a-z0-9]{1,8})$/i.exec(name.trim());
  return match ? `.${match[1].toLowerCase()}` : "";
}

/**
 * One path segment: letters (any script), digits, dot, dash and underscore.
 * Every separator, control char and shell/URL metacharacter collapses to "-",
 * so `../../etc/passwd` becomes `etc-passwd` and can never climb out of the
 * case folder.
 */
function safeSegment(value: string, max: number): string {
  const cleaned = (value ?? "")
    .replace(/\p{Cc}/gu, "")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, max);
  return cleaned || "file";
}

/**
 * `<caseId>/<now>-<random>-<sanitisedName>` in the private `case-files` bucket.
 * The case id folder is the ownership scope the record/delete fns re-check.
 */
export function caseFileStoragePath(
  caseId: string,
  name: string,
  now: number,
  random: string,
): string {
  const folder = safeSegment(caseId, 64);
  const stamp = Number.isFinite(now) ? Math.trunc(now) : 0;
  const suffix = (random ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 16) || "0";
  const ext = fileExtension(name ?? "");
  const base = safeSegment(
    (name ?? "").replace(/\.[a-z0-9]{1,8}$/i, ""),
    MAX_STORED_NAME - ext.length,
  );
  return `${folder}/${stamp}-${suffix}-${base}${ext}`;
}
