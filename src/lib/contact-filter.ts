/**
 * Issue #215 — contact-details filter for tutor-authored public text.
 *
 * Public surfaces must not carry direct-contact channels: the concierge
 * flow (and, later, the notes marketplace) depends on MatchMax staying
 * between parent and tutor. This module is the single source of truth for
 * what counts as a contact detail; it is imported by BOTH the tutor intake
 * zod schema (server-side, the authoritative gate) and the settings
 * self-serve profile form (client-side, so the tutor sees which sentence
 * failed before saving).
 *
 * v1 scope: free text only. The issue's photo warning is copy-only (a
 * failed scan must not block an upload), and there is no OCR in v1.
 */

/** Words that redirect conversations off-platform (issue's explicit list). */
const CHANNEL_WORDS = [
  "whatsapp",
  "wechat",
  "instagram",
  "ig",
  "telegram",
  "signal",
  "qr",
] as const;

/** Word-boundary-wrapped alternation, case-insensitive, all occurrences. */
const CHANNEL_PATTERN = new RegExp(`\\b(?:${CHANNEL_WORDS.join("|")})\\b`, "gi");

/** URL schemes and bare domains (example.com, www.x.com, x.com/path…). */
const URL_PATTERN =
  /(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]{2,}\.(?:com|net|org|hk|io|co|me|edu|gov)(?:[/.?#]\S*)?/i;

/** Emails (subset of a URL match, but standalone addresses too). */
export const CONTACT_EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/;

/**
 * Hong Kong mobile / landline numbers: 8 digits, tolerating the +852
 * prefix and the common 4-4 spacing (9xxx xxxx), plus generic 6-12 digit
 * runs with separators so overseas numbers are caught too. Deliberately
 * loose — a false positive just asks the tutor to rephrase.
 */
const PHONE_PATTERN =
  /(?:\+?852[\s-]?)?[2-9]\d{3}[\s-]?\d{4}\b|\b\d{2,4}[\s-]\d{3,4}[\s-]\d{3,4}\b/;

export type ContactViolation = {
  /** Which rule matched, for the per-rule error copy. */
  kind: "phone" | "email" | "url" | "channel_word";
  /** The matched substring, so the tutor can find it in their text. */
  match: string;
};

/** Scan a block of free text; returns every distinct violation found. */
export function findContactViolations(text: string): ContactViolation[] {
  const violations: ContactViolation[] = [];
  const seen = new Set<string>();
  const push = (kind: ContactViolation["kind"], match: string | undefined) => {
    if (!match) return;
    const key = `${kind}:${match.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    violations.push({ kind, match: match.trim() });
  };

  const phone = text.match(PHONE_PATTERN);
  if (phone) push("phone", phone[0]);
  const email = text.match(CONTACT_EMAIL_PATTERN);
  if (email) push("email", email[0]);
  const url = text.match(URL_PATTERN);
  if (url) push("url", url[0]);
  // Global pattern: collect every channel word, not just the first.
  for (const match of text.matchAll(CHANNEL_PATTERN)) push("channel_word", match[0]);
  return violations;
}

/** True when the text contains anything that looks like a contact channel. */
export function hasContactDetails(text: string): boolean {
  return findContactViolations(text).length > 0;
}

export function describeViolation(v: ContactViolation): string {
  switch (v.kind) {
    case "phone":
      return `"${v.match}" looks like a phone number`;
    case "email":
      return `"${v.match}" is an email address`;
    case "url":
      return `"${v.match}" is a link`;
    case "channel_word":
      return `"${v.match}" names a chat or social app`;
  }
}

/** Join violations into one field-level error message. */
export function contactFilterError(text: string): string | null {
  const violations = findContactViolations(text);
  if (violations.length === 0) return null;
  const listed = violations.slice(0, 3).map(describeViolation).join("; ");
  const rest = violations.length > 3 ? ` (+${violations.length - 3} more)` : "";
  return `No contact details in public text — remove ${listed}${rest}. Parents reach you through MatchMax.`;
}
