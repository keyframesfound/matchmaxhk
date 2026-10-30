/**
 * Server-only blacklist key: HMAC of the normalized phone under the
 * TRUST_PHONE_HASH_SECRET Worker secret (set with `wrangler secret put`).
 *
 * Without the secret this returns null (and warns once): blacklist matching
 * then falls back to parent_id alone instead of writing unkeyed hashes that
 * could never be matched again once the secret is set.
 */

import { hmacPhone } from "@/features/trust/trust";

const SECRET_ENV = "TRUST_PHONE_HASH_SECRET";
let hasWarned = false;

export async function hashPhone(raw: string | null | undefined): Promise<string | null> {
  const secret = process.env[SECRET_ENV];
  if (!secret) {
    if (!hasWarned) {
      console.warn(`[trust] ${SECRET_ENV} is not set; phone-hash blacklist matching is off.`);
      hasWarned = true;
    }
    return null;
  }
  return hmacPhone(raw, secret);
}
