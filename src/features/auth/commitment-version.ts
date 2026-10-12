/**
 * Issue #306 — community commitment versioning.
 *
 * The commitment dialog re-prompts an account whenever the pledge text
 * changes: the gate compares this constant against
 * `profiles.community_commitment_version` (NULL = agreed before
 * versioning, counts as "1"). Bump this constant ONLY when the pledge
 * text in the dialog actually changes — every account then answers the
 * dialog once more on their next login, and nobody is asked again until
 * the next bump.
 */
export const COMMUNITY_COMMITMENT_VERSION = "1";

/**
 * The stored version an agreement counts as when the column is still
 * NULL (accounts that agreed before versioning existed).
 */
export function committedToCurrentVersion(stored: string | null | undefined): boolean {
  return (stored ?? "1") === COMMUNITY_COMMITMENT_VERSION;
}
