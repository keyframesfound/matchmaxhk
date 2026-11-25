/**
 * #783 §2.3: which emails are transactional (always sent) and which are
 * automated marketing (opt-in + max one per 7 days per user, via
 * claim_automated_digest_slot). Pure helpers so vitest and the sender share
 * one definition.
 */

export type EmailClass = "transactional" | "automated_marketing";

/**
 * Transactional templates (receipts, fee reminders, account status, action
 * required, lesson / attendance / trial updates) stay off this list. The
 * weekly learning digest is automated marketing: it carries the 7-day cap and
 * the one-click unsubscribe. New promo or digest templates MUST be listed here
 * as automated_marketing.
 */
const AUTOMATED_MARKETING_TEMPLATES = new Set<string>(["weekly-digest"]);

export function emailClassFor(templateName: string): EmailClass {
  return AUTOMATED_MARKETING_TEMPLATES.has(templateName) ? "automated_marketing" : "transactional";
}

/** Test seam: register a marketing template (e.g. the #717 digest). */
export function registerAutomatedMarketingTemplate(templateName: string) {
  AUTOMATED_MARKETING_TEMPLATES.add(templateName);
}

export const AUTOMATED_EMAIL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Client-side mirror of the DB rule (the RPC is the source of truth). */
export function automatedSlotOpen(lastSentAt: string | null, now: Date): boolean {
  if (!lastSentAt) return true;
  const last = Date.parse(lastSentAt);
  return Number.isNaN(last) || now.getTime() - last >= AUTOMATED_EMAIL_WINDOW_MS;
}

const norm = (value: string) => value.trim().toLowerCase();

/**
 * Anti-cannibalization: drop every promo subject the user already has an
 * active trial (#772) or active case (#615) in. An empty result means the
 * promo must NOT be sent at all.
 */
export function promoSubjectsAllowed(
  candidates: readonly string[],
  activeSubjects: readonly string[],
): string[] {
  const active = activeSubjects.map(norm).filter(Boolean);
  return candidates.filter((subject) => {
    const s = norm(subject);
    return s && !active.some((a) => a === s || a.includes(s) || s.includes(a));
  });
}

/**
 * #783 AC-717-2 at its enforcement point: a promo send may only carry the
 * subjects the recipient has no active trial or case in, and an empty result
 * means the promo must not be sent at all. Called from `sendTemplateEmail`
 * before the 7-day marketing slot is claimed, so a suppressed promo cannot
 * burn the recipient's one automated email of the week.
 */
export function promoDecision(
  candidates: readonly string[],
  activeSubjects: readonly string[],
): { send: boolean; subjects: string[] } {
  const subjects = promoSubjectsAllowed(candidates, activeSubjects);
  return { send: subjects.length > 0, subjects };
}

// --- One-click unsubscribe token (HMAC-SHA256, no expiry, account-bound) ---

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

export async function signUnsubscribeToken(userId: string, secret: string): Promise<string> {
  return `${userId}.${await hmac(secret, `unsubscribe:${userId}`)}`;
}

/** Returns the user id when the token is genuine, else null. */
export async function verifyUnsubscribeToken(
  token: string,
  secret: string,
): Promise<string | null> {
  const [userId, signature] = token.split(".");
  if (!userId || !signature || !/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const expected = await hmac(secret, `unsubscribe:${userId}`);
  if (expected.length !== signature.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1)
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0 ? userId : null;
}
