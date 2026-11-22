/**
 * #785 AC-CONV-1: the online-lesson link a case carries.
 *
 * Pure rules shared by the server fn (setCaseMeetingUrl) and the drawer bar:
 * how the link is normalised, and who may write it. No DB, no React, so the
 * rules are testable on their own.
 */

export const MEETING_URL_MIN = 12;
export const MEETING_URL_MAX = 500;

export type MeetingUrlResult =
  { ok: true; url: string | null } | { ok: false; code: "URL_INVALID" };

/**
 * Trim, then either keep an `https://` link or clear it.
 *
 * An absent value, `null` and an empty string all mean "no link" (the caller
 * clearing the field). Anything else must be an https URL of 12 to 500
 * characters: `http://`, `javascript:` and a bare `zoom.us` are rejected.
 */
export function normaliseMeetingUrl(input: unknown): MeetingUrlResult {
  if (input === null || input === undefined) return { ok: true, url: null };
  if (typeof input !== "string") return { ok: false, code: "URL_INVALID" };
  const url = input.trim();
  if (url.length === 0) return { ok: true, url: null };
  if (!url.startsWith("https://")) return { ok: false, code: "URL_INVALID" };
  if (url.length < MEETING_URL_MIN || url.length > MEETING_URL_MAX) {
    return { ok: false, code: "URL_INVALID" };
  }
  return { ok: true, url };
}

/**
 * The matched tutor owns the lesson link; Ops may set it on their behalf.
 * The parent and the learner are parties, but they only read it.
 */
export function canEditMeetingUrl(role: "tutor" | "parent", isOps: boolean): boolean {
  return role === "tutor" || isOps;
}

/**
 * Clearing is the same permission as setting: whoever may write the link may
 * remove it, so a dead link never needs a developer. Learners never can.
 */
export function canClearMeetingUrl(role: "tutor" | "parent", isOps: boolean): boolean {
  return canEditMeetingUrl(role, isOps);
}
