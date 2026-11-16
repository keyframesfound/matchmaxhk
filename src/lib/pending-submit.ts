import { supabase } from "@/integrations/supabase/client";

/**
 * #759 Part 1 (was #732) — end-of-flow Google sign-in on form submit.
 *
 * Guests fill the Case Request (#049 / #751 / #731) and Tutor Intake (#718)
 * forms completely before authenticating. When a guest clicks the final
 * Submit, the (already validated) form stores a lightweight ENVELOPE here —
 * the field values themselves ride the forms' own sessionStorage drafts
 * (useFormDraft) — and the page redirects into Google OAuth. The OAuth
 * redirectTo points back at the same form route with
 * ?complete_pending_submit=1, where the form hydrates its draft and
 * auto-commits under the now-authenticated session.
 *
 * Hard rules from the ticket:
 * - sessionStorage keeps only lightweight metadata/text (never file blobs —
 *   tutor-intake photos go through pending-files.ts / IndexedDB instead).
 * - The envelope is cleared synchronously BEFORE the submit RPC runs, so a
 *   callback-page refresh can never double-submit.
 * - A 30-minute TTL purges stale envelopes (guest filled the form, left,
 *   and signed in days later via the header).
 */

export const PENDING_SUBMISSION_KEY = "matchmax_pending_submission_v1";
export const COMPLETE_PENDING_PARAM = "complete_pending_submit";
export const PENDING_TTL_MS = 30 * 60 * 1000;

export type PendingFormType = "case_request" | "tutor_intake";
export type PendingSourceIssue = "#731" | "#751" | "#049" | "#718";

export type PendingSubmission = {
  form_type: PendingFormType;
  source_issue: PendingSourceIssue;
  created_at_ms: number;
};

function isPendingSubmission(value: unknown): value is PendingSubmission {
  if (!value || typeof value !== "object") return false;
  const raw = value as Record<string, unknown>;
  return (
    (raw.form_type === "case_request" || raw.form_type === "tutor_intake") &&
    typeof raw.source_issue === "string" &&
    (raw.source_issue as PendingSourceIssue).startsWith("#") &&
    typeof raw.created_at_ms === "number" &&
    Number.isFinite(raw.created_at_ms)
  );
}

/** Append ?complete_pending_submit=1 to a form route path. */
export function urlWithPendingComplete(path: string): string {
  const [base, existingQuery = ""] = path.split("?");
  const params = new URLSearchParams(existingQuery);
  params.set(COMPLETE_PENDING_PARAM, "1");
  return `${base}?${params.toString()}`;
}

/** True when the current URL carries the post-OAuth completion marker. */
export function hasPendingCompleteParam(search: Record<string, unknown>): boolean {
  return search[COMPLETE_PENDING_PARAM] === "1" || search[COMPLETE_PENDING_PARAM] === true;
}

/** Remove the completion marker from the address bar (no history entry). */
export function stripPendingCompleteParam(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(COMPLETE_PENDING_PARAM)) return;
  url.searchParams.delete(COMPLETE_PENDING_PARAM);
  window.history.replaceState(window.history.state, "", url.toString());
}

export function writePendingSubmission(
  formType: PendingFormType,
  sourceIssue: PendingSourceIssue,
): void {
  try {
    sessionStorage.setItem(
      PENDING_SUBMISSION_KEY,
      JSON.stringify({
        form_type: formType,
        source_issue: sourceIssue,
        created_at_ms: Date.now(),
      } satisfies PendingSubmission),
    );
  } catch {
    // Storage unavailable — the OAuth round-trip still works; the user just
    // lands back on the form with their draft and clicks Submit again.
  }
}

/**
 * Read the envelope, enforcing the 30-minute TTL. Expired or corrupt
 * payloads are silently purged (ticket edge-case table).
 */
export function readPendingSubmission(): PendingSubmission | null {
  try {
    const raw = sessionStorage.getItem(PENDING_SUBMISSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isPendingSubmission(parsed)) {
      sessionStorage.removeItem(PENDING_SUBMISSION_KEY);
      return null;
    }
    if (Date.now() - parsed.created_at_ms >= PENDING_TTL_MS) {
      sessionStorage.removeItem(PENDING_SUBMISSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingSubmission(): void {
  try {
    sessionStorage.removeItem(PENDING_SUBMISSION_KEY);
  } catch {
    // ignore
  }
}

/**
 * Serialize the trigger envelope, then hand the browser to Google OAuth with
 * redirectTo pointed back at the current form route. The caller must have
 * validated the form and flushed its draft BEFORE calling this.
 * Throws when Supabase rejects the OAuth attempt (caller shows the error and
 * the user can retry Submit; the envelope is cleared here so a retry starts
 * clean).
 */
export async function startPendingSubmission(
  formType: PendingFormType,
  sourceIssue: PendingSourceIssue,
  returnPath: string,
): Promise<void> {
  writePendingSubmission(formType, sourceIssue);
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${urlWithPendingComplete(returnPath)}`,
      },
    });
    if (error) throw error;
  } catch (err) {
    clearPendingSubmission();
    throw err;
  }
}
