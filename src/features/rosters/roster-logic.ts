/**
 * #613 pure roster/attendance logic. Every rule the issue pins down lives
 * here so the server fns stay thin and the behaviour is testable without a
 * database:
 *   - attendance state machine + completed-count rules (PRESENT/LATE +1)
 *   - 24-hour correction window (edit/void locked afterwards)
 *   - idempotency keys (double-tap Save creates ONE session)
 *   - duplicate-student blocking key (name + parent contact per roster)
 *   - claim token state machine (single-use, 14-day expiry)
 *   - HKT wall-clock helpers (store UTC, display HKT)
 *   - bilingual parent share text
 *   - optimistic-concurrency version check (two markers, one session)
 */

// ---------------------------------------------------------------------------
// Attendance state machine
// ---------------------------------------------------------------------------

export const ATTENDANCE_STATUSES = [
  "present",
  "late",
  "absent_excused",
  "absent_unexcused",
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const SESSION_STATUSES = ["scheduled", "completed", "voided"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/**
 * #613 §2b: PRESENT + LATE increment the cumulative completed-lesson counter
 * by 1; both ABSENT_* states increment 0. Sessions marked but then voided
 * unwind through the same function (delta of old vs new status, or -1 on
 * void), never by special-casing at call sites.
 */
export function completedCountDelta(status: AttendanceStatus | null): 0 | 1 | -1 {
  if (status === "present" || status === "late") return 1;
  if (status == null) return 0;
  return 0;
}

/** Net counter change when one record moves from one status to another. */
export function editCountDelta(from: AttendanceStatus, to: AttendanceStatus): -1 | 0 | 1 {
  const delta = completedCountDelta(to) - completedCountDelta(from);
  return delta as -1 | 0 | 1;
}

export function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return typeof value === "string" && (ATTENDANCE_STATUSES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// 24-hour correction window
// ---------------------------------------------------------------------------

/** #613 §3B: corrections (edits/voids) close 24h after the record was made. */
export const CORRECTION_WINDOW_MS = 24 * 60 * 60 * 1000;

export function canCorrectAttendance(createdAt: string | Date, now: Date): boolean {
  const made = new Date(createdAt).getTime();
  if (!Number.isFinite(made)) return false;
  return now.getTime() - made < CORRECTION_WINDOW_MS;
}

/** Whole seconds left before the record locks (0 once locked); for UI hints. */
export function correctionSecondsLeft(createdAt: string | Date, now: Date): number {
  const made = new Date(createdAt).getTime();
  if (!Number.isFinite(made)) return 0;
  return Math.max(0, Math.floor((made + CORRECTION_WINDOW_MS - now.getTime()) / 1000));
}

// ---------------------------------------------------------------------------
// Idempotency + duplicates
// ---------------------------------------------------------------------------

/**
 * #613 §3B/§5: double-tap Save dedupes on a client-generated session key —
 * the server inserts once against the (roster_id, session_key) unique index.
 * Keys are UUIDs; this validator keeps junk out of the column check.
 */
export function isValidSessionKey(key: unknown): key is string {
  return (
    typeof key === "string" && key.length >= 8 && key.length <= 64 && /^[A-Za-z0-9_-]+$/.test(key)
  );
}

/**
 * #613 §3A/§5: duplicate active student records are blocked idempotently on
 * (roster_id, parent_contact, normalized_student_name). Normalization is
 * NFC + trim + internal-whitespace collapse + lowercase so "Chan Tai Man",
 * "chan tai man " and "CHAN TAI  MAN" collide; CJK names are unaffected by
 * the case fold.
 */
export function normalizeStudentName(name: string): string {
  return name.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

/** The full duplicate key minus the roster (callers scope by roster). */
export function duplicateStudentKey(parentContact: string, studentName: string): string {
  return `${normalizeContact(parentContact)}|${normalizeStudentName(studentName)}`;
}

// ---------------------------------------------------------------------------
// Parent contact (email-or-phone)
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9]{8,15}$/;

export type ContactKind = "email" | "phone";

/** Separators people type inside phone numbers; stripped before classifying. */
const PHONE_SEPARATORS = /[\s().-]/g;

export function contactKind(contact: string): ContactKind | null {
  if (EMAIL_RE.test(contact)) return "email";
  if (PHONE_RE.test(contact.replace(PHONE_SEPARATORS, ""))) return "phone";
  return null;
}

/**
 * Canonical form for storage + the duplicate key: emails lowercased/trimmed;
 * phones reduced to digits with a leading + kept. "852-9123 4567" and
 * "+85291234567" are the same contact.
 */
export function normalizeContact(contact: string): string {
  const trimmed = contact.trim();
  if (EMAIL_RE.test(trimmed)) return trimmed.toLowerCase();
  const digits = trimmed.replace(PHONE_SEPARATORS, "").replace(/[^0-9]/g, "");
  if (PHONE_RE.test(trimmed.replace(PHONE_SEPARATORS, ""))) return `+${digits}`;
  return trimmed.toLowerCase();
}

// ---------------------------------------------------------------------------
// Claim tokens
// ---------------------------------------------------------------------------

export const CLAIM_TOKEN_DAYS = 14;

export type ClaimTokenState = "valid" | "used" | "revoked" | "expired";

export type ClaimTokenFields = {
  used_at: string | null;
  revoked_at: string | null;
  expires_at: string;
};

/** Single-use, revoke-before-use, 14-day expiry — checked in this order. */
export function claimTokenState(row: ClaimTokenFields, now: Date): ClaimTokenState {
  if (row.used_at) return "used";
  if (row.revoked_at) return "revoked";
  if (new Date(row.expires_at).getTime() <= now.getTime()) return "expired";
  return "valid";
}

// ---------------------------------------------------------------------------
// HKT wall clock (store UTC, display HKT)
// ---------------------------------------------------------------------------

export const HKT_OFFSET_MINUTES = 8 * 60;

/** "YYYY-MM-DD" for right now in Hong Kong, whatever the server TZ is. */
export function todayHkt(now: Date): string {
  return new Date(now.getTime() + HKT_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

/** "HH:MM" for right now in Hong Kong, minute-rounded for the check-in form. */
export function nowHktTime(now: Date): string {
  return new Date(now.getTime() + HKT_OFFSET_MINUTES * 60_000).toISOString().slice(11, 16);
}

/** Today + current time as the check-in modal defaults ("2026-11-07", "14:05"). */
export function hktCheckInDefaults(now: Date): { date: string; time: string } {
  return { date: todayHkt(now), time: nowHktTime(now) };
}

/** UTC instant for an HKT wall-clock date+time (attendance display and locks). */
export function hktWallClockToUtcIso(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const utcMs = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0) - HKT_OFFSET_MINUTES * 60_000;
  return new Date(utcMs).toISOString();
}

/**
 * "7 Nov, 14:05 HKT" / zh "11月7日 14:05 (HKT)" — the fixed +08:00 clock,
 * independent of the device timezone.
 */
export function formatHktDateTime(utcIso: string | Date, lang: string): string {
  const hkt = new Date(new Date(utcIso).getTime() + HKT_OFFSET_MINUTES * 60_000);
  const day = hkt.getUTCDate();
  const month = hkt.getUTCMonth() + 1;
  const time = hkt.toISOString().slice(11, 16);
  return lang.startsWith("zh")
    ? `${month}月${day}日 ${time} (HKT)`
    : `${day} ${MONTHS_EN[hkt.getUTCMonth()]} ${time} HKT`;
}

const MONTHS_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

// ---------------------------------------------------------------------------
// Optimistic concurrency
// ---------------------------------------------------------------------------

/**
 * #613 §5: two markers on the same session — the second save carries the
 * updated_at it based its edit on; a mismatch means the row moved and the
 * client must refresh. String compare is safe: the trigger writes
 * `now()` ISO timestamps that sort lexicographically.
 */
export function isStaleVersion(baseUpdatedAt: string, currentUpdatedAt: string): boolean {
  return baseUpdatedAt !== currentUpdatedAt;
}

// ---------------------------------------------------------------------------
// Engagement type + source tag locks
// ---------------------------------------------------------------------------

export const ENGAGEMENT_TYPES = ["standard_ongoing", "short_course"] as const;
export type EngagementType = (typeof ENGAGEMENT_TYPES)[number];
export type SourceType = "partner_course" | "matched_case" | "private_class";
export type StudentSourceTag = "matchmax_matched" | "self_brought";

/**
 * #613 §3A: engagement type is the educator's choice, but Matched Cases
 * auto-lock (platform-matched engagements are ongoing tuition; the lock is
 * the point — the educator cannot relabel a MatchMax match as a short
 * course to dodge package tracking).
 */
export function engagementLockedFor(sourceType: SourceType): boolean {
  return sourceType === "matched_case";
}

/** The locked value for Matched Cases (the educator's pick applies elsewhere). */
export const LOCKED_ENGAGEMENT: EngagementType = "standard_ongoing";

/**
 * #613 §2: strict MATCHMAX_MATCHED vs SELF_BROUGHT separation — a Matched
 * Case roster tags every student MATCHMAX_MATCHED; partner courses and
 * private classes tag SELF_BROUGHT.
 */
export function sourceTagForRoster(sourceType: SourceType): StudentSourceTag {
  return sourceType === "matched_case" ? "matchmax_matched" : "self_brought";
}

// ---------------------------------------------------------------------------
// Parent share text (bilingual)
// ---------------------------------------------------------------------------

export const MAX_SESSION_NOTE_LENGTH = 200;

export type ShareTextInput = {
  courseName: string;
  studentName: string;
  claimUrl: string;
};

/** §4.3 exact EN copy. */
export function buildShareTextEn({ courseName, studentName, claimUrl }: ShareTextInput): string {
  return `Hi! We use MatchMax to send real-time attendance notifications for ${courseName}. Tap here to link ${studentName}'s attendance record (free): ${claimUrl}`;
}

/** §4.3 繁中 equivalent. */
export function buildShareTextZh({ courseName, studentName, claimUrl }: ShareTextInput): string {
  return `您好！我們透過 MatchMax 為 ${courseName} 發送即時課堂點名通知。請點擊以下連結，免費綁定 ${studentName} 的點名紀錄：${claimUrl}`;
}

/** The educator copies both lines at once (WhatsApp handles the newline). */
export function buildShareTextBoth(input: ShareTextInput): string {
  return `${buildShareTextEn(input)}\n${buildShareTextZh(input)}`;
}
