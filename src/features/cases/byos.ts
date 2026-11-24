/**
 * #783 §2.4 (was #737): Bring Your Own Student (BYOS) one-time invite.
 *
 * A tutor invites an EXISTING off-platform student / parent. Claiming the
 * invite opens a case with case_source = BYOS_DIRECT and admin_fee_waived =
 * true (HK$0 admin fee). Tuition still goes parent → tutor. The waiver is
 * refused when the claimant already inquired about or was matched with this
 * tutor on MatchMax (anti-circumvention), and the normal fee path remains.
 *
 * Pure helpers shared by the server fns and vitest.
 */

export const BYOS_CASE_SOURCE = "BYOS_DIRECT" as const;

/** 32 random bytes, base64url: the raw token only ever lives in the link. */
export function newInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isWellFormedInviteToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** The DB stores only this SHA-256 hex digest. */
export async function hashInviteToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const BYOS_LESSON_MODES = ["online", "f2f"] as const;
export type ByosLessonMode = (typeof BYOS_LESSON_MODES)[number];

export type ByosInviteInput = {
  inviteeLabel: string;
  subject: string;
  level: string;
  hourlyRateHkd: number;
  lessonMode: string;
};

export type ByosInputProblem = "label" | "subject" | "level" | "rate" | "mode";

export function validateByosInvite(input: ByosInviteInput): ByosInputProblem | null {
  const label = input.inviteeLabel.trim();
  if (label.length < 1 || label.length > 60) return "label";
  const subject = input.subject.trim();
  if (subject.length < 1 || subject.length > 80) return "subject";
  if (input.level.trim().length > 80) return "level";
  const rate = input.hourlyRateHkd;
  if (!Number.isFinite(rate) || rate <= 0 || rate > 100_000) return "rate";
  if (!(BYOS_LESSON_MODES as readonly string[]).includes(input.lessonMode)) return "mode";
  return null;
}

/**
 * What the claimant's history with THIS tutor looks like. Each flag comes from
 * a live record tied to the account (or its phone): a request matched to the
 * tutor, a trial intro with the tutor (#772 subject signal), or the tutor
 * applying to one of the claimant's requests.
 */
export type PriorContact = {
  matchedCase: boolean;
  trialIntro: boolean;
  tutorApplied: boolean;
  /**
   * #737: when the MOST RECENT qualifying interaction happened (ISO). `null`
   * means there is history but no datable row; `undefined` means the caller
   * supplies no timestamps at all (legacy callers keep the old rule).
   */
  lastContactAt?: string | null;
};

/**
 * #737: prior on-platform contact only refuses the waiver while it is recent.
 *
 * A single interaction years ago must not lock a tutor's own off-platform
 * student out of the HK$0 fee forever, so the lookback stops at 180 days. Past
 * the window the invite is allowed; the normal fee path was always available.
 */
export const BYOS_PRIOR_CONTACT_WINDOW_DAYS = 180;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * True when a qualifying interaction falls inside the lookback window.
 *
 * Undatable history (a flag set with no timestamp) stays refused — the only
 * cost is the normal admin fee, while granting it to a tutee the tutor already
 * met on-platform is the exact loophole this rule exists to close.
 */
export function byosPriorContactRefused(prior: PriorContact, now: Date = new Date()): boolean {
  if (!prior.matchedCase && !prior.trialIntro && !prior.tutorApplied) return false;
  if (prior.lastContactAt === undefined) return true;
  const at = prior.lastContactAt === null ? Number.NaN : Date.parse(prior.lastContactAt);
  if (!Number.isFinite(at)) return true;
  return now.getTime() - at < BYOS_PRIOR_CONTACT_WINDOW_DAYS * DAY_MS;
}

export type ByosClaimRefusal = "own_invite" | "prior_contact" | "not_active" | "expired";

/**
 * #737 §3 MUST: an invite expires 7 days after it is created.
 *
 * The token is a 32-byte secret handed out over WhatsApp, so the window is the
 * only thing limiting the blast radius of a leaked link. Without it, an old
 * invite would grant the HK$0 admin fee forever.
 */
export const BYOS_INVITE_TTL_DAYS = 7;

export function byosInviteExpired(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!expiresAt) return false;
  const at = Date.parse(expiresAt);
  // Fail open on an unparseable value: the column is written by the DB, so a
  // malformed row is a data glitch, not an attack, and it must not refuse a
  // genuine student their invite.
  if (!Number.isFinite(at)) return false;
  return now.getTime() >= at;
}

/**
 * Null = the waiver may be granted. Anti-circumvention: prior on-platform
 * contact with this tutor INSIDE the 180-day window refuses the waiver (the
 * normal fee applies).
 */
export function byosClaimRefusal(input: {
  inviteStatus: string;
  claimantIsTutor: boolean;
  prior: PriorContact;
  /** #737 §3: the invite's 7-day window has closed. */
  expired?: boolean;
  /** #737: clock for the 180-day prior-contact window (tests pin it). */
  now?: Date;
}): ByosClaimRefusal | null {
  if (input.inviteStatus !== "active") return "not_active";
  if (input.expired) return "expired";
  if (input.claimantIsTutor) return "own_invite";
  if (byosPriorContactRefused(input.prior, input.now)) return "prior_contact";
  return null;
}

/** Path of the claim landing page for a token. */
export function byosInvitePath(token: string): string {
  return `/invite/case/${token}`;
}
