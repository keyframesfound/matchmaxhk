import type { Tutor } from "@/features/tutors/queries";

/**
 * Issue #104: guided "Preview as parent" sandbox. Pure helpers only, the
 * preview route + tests use these; server-side data stays behind the same
 * public query fns the public profile uses.
 *
 * Leak rule: the preview must never surface anything a parent cannot see, so
 * the owner read below selects ONLY card-publication fields (code, published
 * flag, owner link, all already on the public tutors shape) and the rendered
 * preview is built exclusively from `fetchTutorByCode`'s public `Tutor`.
 */

/** Minimal owner read (RLS tutors_owner_select): the session user's tutors row. */
export const PREVIEW_OWNER_COLUMNS = "tutor_code, is_published, user_id";

export type PreviewOwnerRow = {
  tutor_code: string | null;
  is_published: boolean | null;
  user_id: string | null;
} | null;

/**
 * #356 go-live state machine, preview side: a card is LIVE only when the
 * owner row exists and is_published. The only owner path to live is
 * submitting /join (submitTutorApplication → publish_tutor_from_application),
 * so "not live" splits into no application yet vs an unpublished card.
 */
export type PreviewCardState =
  { status: "live"; tutorCode: string } | { status: "not_live"; reason: "no_card" | "unpublished" };

export function resolvePreviewCardState(ownerRow: PreviewOwnerRow): PreviewCardState {
  const code = ownerRow?.tutor_code?.trim() ?? "";
  if (!ownerRow || !code) return { status: "not_live", reason: "no_card" };
  if (ownerRow.is_published !== true) return { status: "not_live", reason: "unpublished" };
  return { status: "live", tutorCode: code };
}

/**
 * The submit/go-live CTA shows in the preview toolbar ONLY while the card is
 * not live; a live card shows no submit button.
 */
export function shouldShowGoLiveCta(state: PreviewCardState): boolean {
  return state.status === "not_live";
}

/** What the preview route still needs to fetch, given the owner row. */
export type PreviewFetchPlan =
  | { stage: "public_data"; tutorCode: string }
  | { stage: "empty_state"; reason: "no_card" | "unpublished" };

export function buildPreviewFetchPlan(ownerRow: PreviewOwnerRow): PreviewFetchPlan {
  const state = resolvePreviewCardState(ownerRow);
  return state.status === "live"
    ? { stage: "public_data", tutorCode: state.tutorCode }
    : { stage: "empty_state", reason: state.reason };
}

/**
 * #294 remainder: owner guard for the report affordances shown in the
 * preview. True only when the signed-in account owns the reported target;
 * public surfaces never call this and pass no prop, so their behavior is
 * unchanged.
 */
export function isOwnReportTarget(
  viewerUserId: string | null | undefined,
  ownerUserId: string | null | undefined,
): boolean {
  return Boolean(viewerUserId && ownerUserId && viewerUserId === ownerUserId);
}

/** The preview's owner-guard input for tutor targets, from a public Tutor. */
export function isOwnTutorPreview(
  viewerUserId: string | null | undefined,
  tutor: Pick<Tutor, "user_id"> | null | undefined,
): boolean {
  return isOwnReportTarget(viewerUserId, tutor?.user_id);
}
