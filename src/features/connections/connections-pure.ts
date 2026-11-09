/**
 * #617 Tutor Connections, pure rules (the vitest target; the server fns in
 * connections.functions.ts stay untestable end-to-end per repo precedent).
 *
 * Covers: the intent-tag vocabulary, the 140-char intro-note sanitizer
 * (phone / WhatsApp / Telegram / email stripping with the inline
 * [Contact hidden] token), the ordered-pair edge state machine (mutual
 * simultaneous requests auto-accept through the pair unique index), the
 * 30-day decline cooldown and the outbound rate caps.
 *
 * Intentionally dependency-free: tests import this file RELATIVELY (the @/
 * alias does not resolve under vitest on the Pi).
 */

export const CONNECT_INTENT_TAGS = [
  "SUBJECT_SPLIT",
  "GROUP_COTEACH",
  "RELIEF_COVER",
  "CURRICULUM_PAIR",
] as const;

export type ConnectIntentTag = (typeof CONNECT_INTENT_TAGS)[number];

export function isConnectIntentTag(value: unknown): value is ConnectIntentTag {
  return typeof value === "string" && (CONNECT_INTENT_TAGS as readonly string[]).includes(value);
}

export const CONNECTION_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "DECLINED",
  "DISCONNECTED",
  "BLOCKED",
] as const;

export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

/** Hard input cap (UI textarea maxLength mirrors this). */
export const MAX_INTRO_NOTE_CHARS = 140;
/**
 * Output cap: token replacement can inflate a 140-char note (one token is
 * longer than the phone number it hides), so the stored note is trimmed
 * again after sanitizing. A cut token renders as plain text — no leak.
 */
export const MAX_SANITIZED_NOTE_CHARS = 180;
/** 30-day decline cooldown (#617). */
export const DECLINE_COOLDOWN_DAYS = 30;
/** Max 10 outbound connect requests per rolling 24h. */
export const OUTBOUND_REQUEST_CAP_24H = 10;
/** Max 25 open PENDING outbound requests per tutor. */
export const OPEN_PENDING_OUTBOUND_CAP = 25;
/** Rolling outbound window. */
export const OUTBOUND_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Placeholder the sanitizer stamps in place of stripped contact details.
 * The UI renders it localized via renderSanitizedNote; the stored note
 * itself stays locale-free.
 */
export const HIDDEN_CONTACT_TOKEN = "[[mm_hidden_contact]]";

/** wa.me / api.whatsapp.com / chat.whatsapp.com / t.me deep links. */
const LINK_PATTERNS: RegExp[] = [
  /(?:https?:\/\/)?(?:www\.)?wa\.me\/\S+/gi,
  /(?:https?:\/\/)?(?:api|chat)\.whatsapp\.com\/\S+/gi,
  /(?:https?:\/\/)?t\.me\/\S+/gi,
];

/** Bare emails (NFKC already folded full-width ＠ and digits). */
const EMAIL_PATTERN = /[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+/g;
/** Any digit run of 8+ (an 11-digit 852-prefixed number pasted raw). */
const LONG_DIGIT_RUN = /(?<!\d)\d{8,}(?!\d)/g;
/** HK mobile: optional +852/852 prefix, 4+4 digits with an optional space,
 * dot or hyphen. Over-masking (rates like "1200 1500") is the safe
 * direction — contact details must never leak through the intro note. */
const HK_PHONE_PATTERN = /(?<!\d)(?:\+?852[\s\-.]?)?\d{4}[\s\-.]?\d{4}(?!\d)/g;

/**
 * Sanitize an optional intro note. Returns null when the input is empty or
 * over the 140-char cap (the caller rejects with a validation error).
 * Full-width digits/punctuation are folded first (NFKC), then links,
 * emails and phone patterns are replaced with HIDDEN_CONTACT_TOKEN.
 */
export function sanitizeIntroNote(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (Array.from(trimmed).length > MAX_INTRO_NOTE_CHARS) return null;

  let out = trimmed.normalize("NFKC");
  for (const pattern of LINK_PATTERNS) out = out.replace(pattern, HIDDEN_CONTACT_TOKEN);
  out = out.replace(EMAIL_PATTERN, HIDDEN_CONTACT_TOKEN);
  out = out.replace(LONG_DIGIT_RUN, HIDDEN_CONTACT_TOKEN);
  out = out.replace(HK_PHONE_PATTERN, HIDDEN_CONTACT_TOKEN);
  out = out.replace(/\s+/g, " ").trim();
  if (!out) return null;
  return out.length > MAX_SANITIZED_NOTE_CHARS ? out.slice(0, MAX_SANITIZED_NOTE_CHARS) : out;
}

/**
 * Render a stored sanitized note for one viewer: the hidden-contact token
 * becomes the viewer's localized placeholder, everything else passes
 * through untouched.
 */
export function renderSanitizedNote(note: string | null | undefined, replacement: string): string {
  if (!note) return "";
  return note.split(HIDDEN_CONTACT_TOKEN).join(replacement);
}

/** cooldown_until for a decline: now + 30 days (ISO string). */
export function declineCooldownUntil(now: Date): string {
  return new Date(now.getTime() + DECLINE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function isWithinCooldown(cooldownUntil: string | null | undefined, now: Date): boolean {
  if (!cooldownUntil) return false;
  const t = Date.parse(cooldownUntil);
  return Number.isFinite(t) && t > now.getTime();
}

/**
 * How many of these creation timestamps fall inside the rolling 24h window
 * ending at `now` (the outbound daily cap counts every request event,
 * including reopened re-requests).
 */
export function countOutboundRequests24h(createdAts: readonly string[], now: Date): number {
  const cutoff = now.getTime() - OUTBOUND_WINDOW_MS;
  return createdAts.filter((createdAt) => {
    const t = Date.parse(createdAt);
    return Number.isFinite(t) && t >= cutoff;
  }).length;
}

export type OutboundGateVerdict = "ok" | "daily_cap" | "pending_cap";

/** Rate caps: 10 outbound / 24h first (the harder cap), then 25 open. */
export function gateOutbound(
  outbound24hCount: number,
  openPendingOutbound: number,
): OutboundGateVerdict {
  if (outbound24hCount >= OUTBOUND_REQUEST_CAP_24H) return "daily_cap";
  if (openPendingOutbound >= OPEN_PENDING_OUTBOUND_CAP) return "pending_cap";
  return "ok";
}

/** The stored edge shape the decision needs (subset of the DB row). */
export type ExistingEdge = {
  id: string;
  status: ConnectionStatus;
  requester_tutor_id: string;
  cooldown_until: string | null;
};

export type RequestDecision =
  | { action: "insert" }
  | { action: "accept_mutual"; edgeId: string }
  | { action: "reopen"; edgeId: string }
  | { action: "reject"; reason: "cooldown" | "already_connected" | "already_pending" };

/**
 * The ordered-pair state machine for one connect request from `actorTutorId`
 * toward the other half of the pair. The pair unique index (LEAST/GREATEST)
 * guarantees at most one edge per unordered pair, so `existing` is the whole
 * world: no row → insert; their pending request → mutual auto-accept; my
 * pending request → idempotent no-op; accepted → done; declined → reopen
 * only after the 30-day cooldown; disconnected → reopen freely; blocked →
 * permanently rejected.
 */
export function decideRequest(
  existing: ExistingEdge | null,
  actorTutorId: string,
  now: Date,
): RequestDecision {
  if (!existing) return { action: "insert" };
  if (existing.status === "PENDING") {
    if (existing.requester_tutor_id === actorTutorId) {
      return { action: "reject", reason: "already_pending" };
    }
    return { action: "accept_mutual", edgeId: existing.id };
  }
  if (existing.status === "ACCEPTED") {
    return { action: "reject", reason: "already_connected" };
  }
  if (existing.status === "DECLINED") {
    if (isWithinCooldown(existing.cooldown_until, now)) {
      return { action: "reject", reason: "cooldown" };
    }
    return { action: "reopen", edgeId: existing.id };
  }
  if (existing.status === "DISCONNECTED") return { action: "reopen", edgeId: existing.id };
  return { action: "reject", reason: "already_connected" };
}

/**
 * PostgREST or-filter matching the unordered pair in either direction —
 * the payload for the shared Rows.or() builder. `a`/`b` are DB uuids
 * (hex + dash only), so string interpolation is safe.
 */
export function tutorPairFilter(a: string, b: string): string {
  return [
    `and(requester_tutor_id.eq.${a},recipient_tutor_id.eq.${b})`,
    `and(requester_tutor_id.eq.${b},recipient_tutor_id.eq.${a})`,
  ].join(",");
}

/** Canonical ordered pair (min, max) by uuid string order. */
export function orderedPair(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

/**
 * Curriculum labels from a tutors.pricing_tiers payload
 * ([{ curriculum, rate }, ...]); non-string entries are dropped. Kept here
 * so the server fn does not need the client-bundled queries module.
 */
export function extractCurricula(pricingTiers: unknown): string[] {
  if (!Array.isArray(pricingTiers)) return [];
  const out: string[] = [];
  for (const entry of pricingTiers) {
    if (entry && typeof entry === "object") {
      const curriculum = (entry as { curriculum?: unknown }).curriculum;
      if (typeof curriculum === "string" && curriculum.trim()) {
        out.push(curriculum.trim());
      }
    }
  }
  return [...new Set(out)];
}
