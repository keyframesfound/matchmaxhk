/**
 * Issue #459 §4.1 / §15.1.1: public @handle. Mirrors the DB check
 * profiles_handle_format; the DB stays the source of truth (uniqueness).
 */

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 24;

const HANDLE_PATTERN = new RegExp(`^[a-z0-9_]{${HANDLE_MIN},${HANDLE_MAX}}$`);

/** Lowercase, trim, drop a leading @; null when the result is not legal. */
export function normalizeHandle(input: string): string | null {
  const clean = input.trim().toLowerCase().replace(/^@/, "");
  return HANDLE_PATTERN.test(clean) ? clean : null;
}
