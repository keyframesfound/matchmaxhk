/**
 * Issue #650 Safety lite — pure helpers for the trusted-contact surface and
 * the "share your first visit window" flow.
 *
 * CEO locks baked in here:
 *  - Parent is the only initiator; the share payload is time window + tutor
 *    FIRST NAME + area (district / MTR-ish). MUST NOT include an exact unit /
 *    flat / floor or any phone number — this file builds the payload and has
 *    no field for either.
 *  - WhatsApp deep-link + clipboard copy only; no new messaging product.
 *  - Online-only cases (or a first lesson that carries a meeting link) never
 *    auto-prompt; the manual share control stays available (#650 centre/online
 *    lock).
 */

/** Copy locale for the share template (EN + 繁中 per the #650 copy table). */
export type SafetyLocale = "en" | "zh-HK";

export type ShareVisitFields = {
  parentName: string;
  tutorFirstName: string;
  window: string;
  area: string;
};

/** Exact #650 copy table templates (em dashes preserved verbatim). */
const SHARE_BODY_TEMPLATES: Record<SafetyLocale, string> = {
  en: "{ParentName} is expecting tutor {TutorFirstName} around {Window} in {Area}. Sent via MatchMax — no exact address included.",
  "zh-HK":
    "{ParentName} 預計導師 {TutorFirstName} 約於 {Window} 到訪 {Area}。經 MatchMax 分享——不含詳細地址。",
};

/** Field cap shared by the form inputs and the share sheet. */
export const SHARE_FIELD_MAX = 60;

/** Trim + hard-cap one share field; the UI keeps it single-line text. */
export function sanitizeShareField(value: string, max = SHARE_FIELD_MAX): string {
  return value.trim().slice(0, max);
}

/**
 * The exact share body from the #650 copy table. Blank fields render as "—"
 * so a half-filled sheet still previews sensibly; the sheet disables Share /
 * Copy until every field is filled.
 */
export function buildShareBody(fields: ShareVisitFields, locale: SafetyLocale): string {
  const template = SHARE_BODY_TEMPLATES[locale];
  const filled: Record<string, string> = {
    ParentName: sanitizeShareField(fields.parentName) || "—",
    TutorFirstName: sanitizeShareField(fields.tutorFirstName) || "—",
    Window: sanitizeShareField(fields.window) || "—",
    Area: sanitizeShareField(fields.area) || "—",
  };
  return template.replace(/\{(ParentName|TutorFirstName|Window|Area)\}/g, (_, key) => filled[key]);
}

/** Tutor FIRST NAME only (first whitespace token; CJK names are one token). */
export function tutorFirstName(displayName: string | null | undefined): string {
  const name = (displayName ?? "").trim();
  if (!name) return "";
  return name.split(/\s+/)[0] ?? name;
}

const ONLINE_LOCATION_RE = /^(https?:\/\/|www\.)/i;
const ONLINE_PROVIDER_RE = /zoom\.us|meet\.google|teams\.microsoft/i;

/** True when the lesson's location is a meeting link, not a place. */
export function isLikelyOnlineLocation(location: string | null | undefined): boolean {
  const value = (location ?? "").trim();
  if (!value) return false;
  return ONLINE_LOCATION_RE.test(value) || ONLINE_PROVIDER_RE.test(value);
}

/**
 * CEO lock: the one soft auto-prompt fires only for a first in-person /
 * home-visit lesson. Online-only cases never nag; 'either' cases count as
 * home-visit unless lesson 1 carries an online link.
 */
export function isAutoPromptEligible(
  caseMode: string | null | undefined,
  firstLessonLocation: string | null | undefined,
): boolean {
  if (caseMode === "online") return false;
  return !isLikelyOnlineLocation(firstLessonLocation);
}

/** Digits-only, HK local numbers (8 digits) get the 852 country code. */
export function normalizeWaDigits(phone: string | null | undefined): string {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 8) digits = `852${digits}`;
  return digits;
}

/**
 * wa.me deep link. Without a saved contact the parent still gets the prefilled
 * message and picks the recipient in WhatsApp (same fallback as the case
 * apply links).
 */
export function whatsappShareUrl(phone: string | null | undefined, message: string): string {
  const digits = normalizeWaDigits(phone);
  const text = encodeURIComponent(message);
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}

/** "Sat 8 Nov 14:00–15:00" style window label in the app locale. */
export function formatVisitWindow(startsAt: string, durationMin: number, locale: string): string {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return "";
  const end = new Date(start.getTime() + Math.max(0, durationMin) * 60_000);
  const tag = locale?.toLowerCase().startsWith("zh") ? "zh-HK" : "en-GB";
  const day = new Intl.DateTimeFormat(tag, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(start);
  const hm = (d: Date) =>
    new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return `${day} ${hm(start)}–${hm(end)}`;
}

/** Trusted contact row as the client reads it (owner-only RLS). */
export type TrustedContact = {
  id: string;
  parent_id: string;
  display_name: string;
  phone: string;
  created_at: string;
  updated_at: string;
};

/** Per-case auto-prompt lifecycle row (#650). */
export type CaseSafetyShareState = {
  case_id: string;
  parent_id: string;
  prompt_seen_at: string | null;
  dismissed_at: string | null;
  shared_at: string | null;
};

export const TRUSTED_CONTACT_NAME_MAX = 80;
export const TRUSTED_CONTACT_PHONE_MAX = 32;

/** Should the soft prompt card still show for this case? */
export function shouldAutoPrompt(
  state:
    Pick<CaseSafetyShareState, "prompt_seen_at" | "dismissed_at" | "shared_at"> | null | undefined,
): boolean {
  if (!state) return true; // No lifecycle row yet: the one soft prompt is due.
  if (state.prompt_seen_at != null) return false; // The one soft prompt already rendered once (CEO lock: once per case).
  return state.dismissed_at == null && state.shared_at == null;
}

// ---------------------------------------------------------------------------
// Trusted-contact validation (shared by the settings form and the server
// fn, #650). Mirrors features/settings/types isValidPhone so this module
// stays import-free and vitest-testable with relative imports.
// ---------------------------------------------------------------------------

/** Loose Hong Kong phone check: 8 digits starting 2-9, optional +852 prefix. */
export function isValidHkPhone(value: string): boolean {
  const digits = value.replace(/[\s()-]/g, "").replace(/^\+?852/, "");
  return /^[2-9]\d{7}$/.test(digits);
}

export type TrustedContactValidation =
  | { ok: true; displayName: string; phone: string }
  | { ok: false; reason: "name_required" | "phone_invalid" };

/** Trim + cap the form input; the DB CHECK enforces the same bounds. */
export function validateTrustedContact(
  displayName: string,
  phone: string,
): TrustedContactValidation {
  const name = displayName.trim().slice(0, TRUSTED_CONTACT_NAME_MAX);
  const tel = phone.trim().slice(0, TRUSTED_CONTACT_PHONE_MAX);
  if (!name) return { ok: false, reason: "name_required" };
  if (!isValidHkPhone(tel)) return { ok: false, reason: "phone_invalid" };
  return { ok: true, displayName: name, phone: tel };
}

// ---------------------------------------------------------------------------
// Per-case share lifecycle stamps (#650). The server fn upserts exactly this
// payload; "seen" is insert-only so a later seen-stamp can never resurrect a
// dismissed/shared prompt.
// ---------------------------------------------------------------------------

export type SafetyShareStampKind = "seen" | "dismissed" | "shared";

/** Row payload for each lifecycle stamp (prompt_seen_at rides along so a
 *  row created by a dismiss/share still records that the prompt was seen). */
export function safetyShareStamp(
  kind: SafetyShareStampKind,
  now: Date = new Date(),
): { prompt_seen_at: string; dismissed_at?: string; shared_at?: string } {
  const iso = now.toISOString();
  if (kind === "seen") return { prompt_seen_at: iso };
  if (kind === "dismissed") return { prompt_seen_at: iso, dismissed_at: iso };
  return { prompt_seen_at: iso, shared_at: iso };
}

/** First live (non-cancelled) lesson of a case, sequence order. */
export function firstLiveLesson<T extends { sequence: number; status: string }>(
  lessons: T[],
): T | null {
  return (
    lessons
      .filter((l) => l.status !== "cancelled" && l.status !== "late_cancel")
      .sort((a, b) => a.sequence - b.sequence)[0] ?? null
  );
}
