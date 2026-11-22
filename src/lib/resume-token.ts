/**
 * Issue #798 (AC-4, server half): guest join drafts.
 *
 * A guest who starts the tutor application inside an in-app browser (WhatsApp,
 * Instagram, Facebook, Messenger, Line, WeChat, Threads) cannot complete Google
 * OAuth — Google answers `disallowed_useragent` for embedded webviews. The form
 * therefore stashes the in-progress answers here and hands out a resume link
 * that only works in a real browser.
 *
 * Same token hygiene as the child-claim flow (#459): the raw token travels only
 * in the link, the table stores its SHA-256 hex hash, and nothing here touches
 * the database. `join_resume_drafts` is service-role only (RLS on, no policies),
 * so both halves of the flow run through the service-role client.
 */

import { createHash, randomBytes } from "node:crypto";

/** Two hours is long enough to switch browsers, short enough to stay low risk. */
export const RESUME_TTL_MS = 2 * 60 * 60 * 1000;

/** 32 random bytes, base64url — safe in a query string, no padding. */
export function generateResumeToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 hex, matching child_claim_tokens.token_hash. */
export function hashResumeToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
