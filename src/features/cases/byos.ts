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
};

export type ByosClaimRefusal = "own_invite" | "prior_contact" | "not_active";

/**
 * Null = the waiver may be granted. Anti-circumvention: any prior on-platform
 * contact with this tutor refuses the waiver (the normal fee applies).
 */
export function byosClaimRefusal(input: {
  inviteStatus: string;
  claimantIsTutor: boolean;
  prior: PriorContact;
}): ByosClaimRefusal | null {
  if (input.inviteStatus !== "active") return "not_active";
  if (input.claimantIsTutor) return "own_invite";
  const { matchedCase, trialIntro, tutorApplied } = input.prior;
  if (matchedCase || trialIntro || tutorApplied) return "prior_contact";
  return null;
}

/** Path of the claim landing page for a token. */
export function byosInvitePath(token: string): string {
  return `/invite/case/${token}`;
}
