/**
 * #712 AC-1: Pinned Proof Posts on the public channel profile (/u/[handle]).
 *
 * `tutors.achievements` is a public JSONB list (max 3) written by
 * `saveMyAchievementProofs` (#575). The channel shows at most three items that
 * actually carry a public proof photo, and copies ONLY the four public fields
 * below. Nothing else in the stored object (and nothing from a student, case
 * or contact record) can leak through this selector.
 */

export type ChannelProofPost = {
  /** Position in the stored achievements array; stable React key. */
  index: number;
  shortText: string;
  detailText: string | null;
  /** Public `materials-previews` bucket key (never a signed/private URL). */
  imagePath: string;
};

export const MAX_CHANNEL_PROOF_POSTS = 3;

/** Field caps mirror the save-time schema in `proof.functions.ts`. */
const SHORT_TEXT_LIMIT = 120;
const DETAIL_TEXT_LIMIT = 600;
const IMAGE_PATH_LIMIT = 300;

export function selectPinnedProofPosts(
  raw: unknown,
  limit: number = MAX_CHANNEL_PROOF_POSTS,
): ChannelProofPost[] {
  if (!Array.isArray(raw) || limit <= 0) return [];
  const posts: ChannelProofPost[] = [];
  for (let index = 0; index < raw.length && posts.length < limit; index += 1) {
    const value = raw[index];
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const entry = value as Record<string, unknown>;
    const shortText = typeof entry.short_text === "string" ? entry.short_text.trim() : "";
    const imagePath =
      typeof entry.proof_image_path === "string" ? entry.proof_image_path.trim() : "";
    // An achievement without a photo is not a proof post: it stays on the
    // public tutor page and is not duplicated here.
    if (!shortText || !imagePath) continue;
    const detailText = typeof entry.detail_text === "string" ? entry.detail_text.trim() : "";
    posts.push({
      index,
      shortText: shortText.slice(0, SHORT_TEXT_LIMIT),
      detailText: detailText ? detailText.slice(0, DETAIL_TEXT_LIMIT) : null,
      imagePath: imagePath.slice(0, IMAGE_PATH_LIMIT),
    });
  }
  return posts;
}
