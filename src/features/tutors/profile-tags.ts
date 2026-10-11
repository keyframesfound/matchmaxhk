/**
 * Issue #217 — Profile tags, not a feed.
 *
 * Up to five free-text tags per tutor, stored lowercase without the
 * leading "#". Shared by the admin TutorEditor, the tutor self-serve
 * profile form, the public card display, and the /tutors search filter.
 *
 * Rules from the issue:
 * - cap of five tags;
 * - a tag that is (or carries) a phone number, email, or handle is
 *   rejected — reuses the #215 contact filter;
 * - storage is lowercase, hash stripped;
 * - a tag used by three or more tutors appears in search suggestions
 *   (computed client-side over the already-fetched published tutors).
 */

import { hasContactDetails } from "@/lib/contact-filter";

export const MAX_PROFILE_TAGS = 5;
export const MAX_PROFILE_TAG_LENGTH = 30;

/** Normalize free input to the stored shape: trim, strip #, lowercase. */
export function normalizeProfileTag(raw: string): string {
  return raw.trim().replace(/^#+/, "").toLowerCase().slice(0, MAX_PROFILE_TAG_LENGTH);
}

export type ProfileTagParseResult =
  { ok: true; tags: string[] } | { ok: false; error: "too_many" | "contact"; tag?: string };

/**
 * Validate a full tag list. Returns the clean list (deduped, order kept)
 * or why the list must not be saved. The error is a stable code — the UIs
 * translate it (settings form is bilingual; the admin editor is English).
 */
export function parseProfileTags(input: unknown): ProfileTagParseResult {
  if (!Array.isArray(input)) return { ok: false, error: "too_many" };
  const tags: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const tag = normalizeProfileTag(raw);
    if (!tag) continue;
    if (!tags.includes(tag)) tags.push(tag);
  }
  if (tags.length > MAX_PROFILE_TAGS) return { ok: false, error: "too_many" };
  const contactTag = tags.find((tag) => hasContactDetails(tag));
  if (contactTag) return { ok: false, error: "contact", tag: contactTag };
  return { ok: true, tags };
}

/** Tags used by >= minCount tutors, most-used first (search suggestions). */
export function popularProfileTags(tutors: { profile_tags: string[] }[], minCount = 3): string[] {
  const counts = new Map<string, number>();
  for (const tutor of tutors) {
    for (const tag of tutor.profile_tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= minCount)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}
