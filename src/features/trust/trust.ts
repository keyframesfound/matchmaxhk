/**
 * Issue #535 (child of #529) — minimal trust schema + progressive reveal.
 *
 * Pure vocabulary and gates shared by the trust server fns, the tutor-facing
 * case API, the Apply gate and the vitest suite. Ships BEFORE the full WA AI
 * desk (#511): every flag here is manual or `ai_advisory`, and an advisory
 * flag never bans or blacklists on its own (humans resolve, #529 §5).
 *
 *   * trust_blacklist — a parent or tutor, keyed by a phone hash, with a
 *     reason enum and the source case. Checked on case intake.
 *   * case_risk_flags — many flags per case (enum + confidence + source), so
 *     the later classifier writes rows without a schema rewrite.
 *   * Progressive reveal — parent contact stays masked for new / part-time
 *     tutors until the intro fee is settled or they hold verified hours, and
 *     for everyone while a blocking risk flag is open.
 *   * New-tutor concurrency cap — under 3 verified hours a tutor holds at
 *     most N open first lessons (default 2, app_settings override).
 *
 * Does NOT touch Drop-Protection fee math (#520 / #525 live in fee-drop.ts).
 */

import { normalizePhone } from "@/features/cases/import-plan";

export const BLACKLIST_REASONS = [
  "HOSTILE_PARENT",
  "SCAM_OVERPAYMENT",
  "FEE_EVASION_BYPASS",
  "FAKE_CREDENTIALS",
  "BAIT_AND_SWITCH",
  "HARASSMENT",
] as const;
export type BlacklistReason = (typeof BLACKLIST_REASONS)[number];

export const BLACKLIST_SUBJECTS = ["parent", "tutor"] as const;
export type BlacklistSubject = (typeof BLACKLIST_SUBJECTS)[number];

export const CASE_RISK_FLAG_TYPES = [
  "HIGH_RISK_LOCATION",
  "LATE_NIGHT_ADULT",
  "SCAM_OVERPAYMENT",
  "SCAM_BAIT_AND_SWITCH",
  "HOSTILE_OR_ABUSIVE_CLIENT",
  "BYPASS_COLLUSION_RISK",
  "SERIAL_HOPPER_PARENT",
  "TUTOR_GHOST_RISK",
  "BLACKLISTED_CONTACT",
] as const;
export type CaseRiskFlagType = (typeof CASE_RISK_FLAG_TYPES)[number];

export const RISK_FLAG_SOURCES = ["manual", "ai_advisory", "system"] as const;
export type RiskFlagSource = (typeof RISK_FLAG_SOURCES)[number];

/** Flags that revoke contact reveal while unresolved (#529 classifier table). */
export const REVEAL_BLOCKING_FLAGS: readonly CaseRiskFlagType[] = [
  "SCAM_OVERPAYMENT",
  "SCAM_BAIT_AND_SWITCH",
  "HOSTILE_OR_ABUSIVE_CLIENT",
  "BLACKLISTED_CONTACT",
];

/** #529: a tutor under this many verified hours is "new" for the gates. */
export const NEW_TUTOR_VERIFIED_HOURS = 3;
export const DEFAULT_NEW_TUTOR_FIRST_LESSON_CAP = 2;
export const FIRST_LESSON_CAP_SETTING_KEY = "trust_new_tutor_first_lesson_cap";
export const BLACKLIST_NOTE_MAX = 500;
const MAX_CONFIGURABLE_CAP = 20;

export const BLACKLIST_REASON_LABELS: Record<BlacklistReason, string> = {
  HOSTILE_PARENT: "Hostile or abusive parent",
  SCAM_OVERPAYMENT: "Overpayment scam",
  FEE_EVASION_BYPASS: "Fee evasion / bypass",
  FAKE_CREDENTIALS: "Fake credentials",
  BAIT_AND_SWITCH: "Bait and switch",
  HARASSMENT: "Harassment",
};

export const CASE_RISK_FLAG_LABELS: Record<CaseRiskFlagType, string> = {
  HIGH_RISK_LOCATION: "High-risk location",
  LATE_NIGHT_ADULT: "Late-night adult booking",
  SCAM_OVERPAYMENT: "Overpayment scam",
  SCAM_BAIT_AND_SWITCH: "Bait and switch",
  HOSTILE_OR_ABUSIVE_CLIENT: "Hostile or abusive client",
  BYPASS_COLLUSION_RISK: "Bypass / collusion risk",
  SERIAL_HOPPER_PARENT: "Serial hopper parent",
  TUTOR_GHOST_RISK: "Tutor ghost risk",
  BLACKLISTED_CONTACT: "Contact on the trust blacklist",
};

export function isBlacklistReason(value: unknown): value is BlacklistReason {
  return (BLACKLIST_REASONS as readonly unknown[]).includes(value);
}

export function isCaseRiskFlagType(value: unknown): value is CaseRiskFlagType {
  return (CASE_RISK_FLAG_TYPES as readonly unknown[]).includes(value);
}

/**
 * HMAC-SHA256 hex of the normalized phone under a server secret, the
 * blacklist lookup key. Keyed so an exported or leaked trust_blacklist row
 * cannot be brute-forced back to a number across the ~10^8 HK phone space.
 * Null when the input is too short to be a phone number or no secret is set.
 * Callers use phone-hash.server.ts, which supplies the secret.
 */
export async function hmacPhone(
  raw: string | null | undefined,
  secret: string | null | undefined,
): Promise<string | null> {
  const digits = normalizePhone(raw ?? "");
  if (digits.length < 8 || !secret) return null;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(digits));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** "9123 4567" → "9••• ••67": first and last two digits only. */
export function maskPhone(raw: string | null | undefined): string | null {
  const digits = normalizePhone(raw ?? "");
  if (digits.length < 4) return null;
  const masked = `${digits[0]}${"•".repeat(digits.length - 3)}${digits.slice(-2)}`;
  return masked.length === 8 ? `${masked.slice(0, 4)} ${masked.slice(4)}` : masked;
}

/** "Chan Tai Man" → "Chan T." — enough to greet, not to search. */
export function maskName(raw: string | null | undefined): string | null {
  const parts = (raw ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}

export type RevealBlockReason =
  "NOT_MATCHED" | "CASE_CLOSED" | "RISK_HOLD" | "FEE_OR_HOURS_REQUIRED";

export type RevealInput = {
  /** The tutor is the matched tutor (accepted the case + fee terms). */
  isMatchedTutor: boolean;
  caseClosed: boolean;
  /** Unresolved case_risk_flags types on the case. */
  openFlagTypes: readonly string[];
  /** Intro fee row paid or waived. */
  introFeeSettled: boolean;
  tutorVerifiedHours: number;
};

export type RevealResult = { reveal: true } | { reveal: false; reason: RevealBlockReason };

/** The progressive reveal gate (#535 / #529 A3 "Tutor anti-poach"). */
export function canRevealParentContact(input: RevealInput): RevealResult {
  if (!input.isMatchedTutor) return { reveal: false, reason: "NOT_MATCHED" };
  if (input.caseClosed) return { reveal: false, reason: "CASE_CLOSED" };
  const isHeld = input.openFlagTypes.some((f) =>
    (REVEAL_BLOCKING_FLAGS as readonly string[]).includes(f),
  );
  if (isHeld) return { reveal: false, reason: "RISK_HOLD" };
  if (input.introFeeSettled) return { reveal: true };
  if (input.tutorVerifiedHours >= NEW_TUTOR_VERIFIED_HOURS) return { reveal: true };
  return { reveal: false, reason: "FEE_OR_HOURS_REQUIRED" };
}

export type ParentContactView = {
  revealed: boolean;
  name: string | null;
  phone: string | null;
  reason: RevealBlockReason | null;
};

/** Shape the contact a tutor-facing API may return, masked unless the gate clears. */
export function parentContactView(
  contact: { name: string | null; phone: string | null },
  gate: RevealResult,
): ParentContactView {
  if (gate.reveal) {
    return { revealed: true, name: contact.name, phone: contact.phone, reason: null };
  }
  return {
    revealed: false,
    name: maskName(contact.name),
    phone: maskPhone(contact.phone),
    reason: gate.reason,
  };
}

/** Parse the app_settings override; junk or absent → the default cap. */
export function resolveFirstLessonCap(settingValue: unknown): number {
  const n = Number(settingValue);
  return Number.isInteger(n) && n >= 1 && n <= MAX_CONFIGURABLE_CAP
    ? n
    : DEFAULT_NEW_TUTOR_FIRST_LESSON_CAP;
}

export type FirstLessonCapResult =
  { ok: true } | { ok: false; reason: "NEW_TUTOR_CAP_REACHED"; cap: number };

/**
 * New-tutor concurrency cap: under NEW_TUTOR_VERIFIED_HOURS, at most `cap`
 * cases may sit before a completed Lesson 1. Established tutors are uncapped.
 */
export function checkFirstLessonCap(input: {
  tutorVerifiedHours: number;
  openFirstLessonCount: number;
  cap: number;
}): FirstLessonCapResult {
  if (input.tutorVerifiedHours >= NEW_TUTOR_VERIFIED_HOURS) return { ok: true };
  if (input.openFirstLessonCount < input.cap) return { ok: true };
  return { ok: false, reason: "NEW_TUTOR_CAP_REACHED", cap: input.cap };
}

/** SoR statuses where a case still waits on its first completed lesson. */
export const OPEN_FIRST_LESSON_STATUSES = ["introduced", "lesson_1_scheduled"] as const;

/** Verified platform hours from minute totals (lessons + verified logs). */
export function verifiedHoursFromMinutes(minutes: readonly number[]): number {
  const total = minutes.reduce((sum, m) => (Number.isFinite(m) && m > 0 ? sum + m : sum), 0);
  return Math.round((total / 60) * 100) / 100;
}
