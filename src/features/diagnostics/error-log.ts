/**
 * Error pipeline, shared helpers (no I/O, safe on both sides).
 *
 * Rows are keyed by a fingerprint so the same failure increments occurrences
 * instead of flooding the table. Stack frames are excluded on purpose:
 * filename hashes change every deploy, so grouping on them would mint a fresh
 * row per release. Path (not the full URL) keeps the same bug on
 * /en/account/cases and /zh/account/cases together.
 */

export type ErrorSource = "client" | "server";

export function errorFingerprint(source: ErrorSource, message: string, url: string): string {
  const path = (url || "")
    .replace(/^https?:\/\/[^/]+/i, "")
    .split("?")[0]
    .slice(0, 160);
  const input = `${source}|${message.slice(0, 300)}|${path}`;
  // cyrb53: small, stable, no dependency.
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

/**
 * Only system-shaped failures are worth a row from the server middleware.
 * A handler that throws "Order not found." is a business rule the UI already
 * explains; a PostgREST code, a missing column or a TypeError is a defect.
 */
export function isSystemFailure(message: string): boolean {
  return /PGRST|does not exist|could not embed|more than one relationship|violates |duplicate key|null value in column|invalid input (syntax|value)|Cannot read|Cannot access|is not a function|is not defined|TypeError|ReferenceError|Econn|ECONN|ETIMEDOUT|timed out|timeout/i.test(
    message,
  );
}

/** Session expiry and a bare offline blip are not defects; do not log them. */
export function isExpectedNoise(message: string): boolean {
  const trimmed = message.trim();
  return /^Unauthorized/i.test(trimmed) || /^Failed to fetch\.?$/i.test(trimmed);
}
