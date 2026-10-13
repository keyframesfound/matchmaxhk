/**
 * Issues #217 + #311 — Profile tags, not a feed.
 *
 * Up to five free-text tags per tutor, stored lowercase without the
 * leading "#". Shared by the admin TutorEditor, the tutor self-serve
 * profile form, the public card display, and the /tutors search filter.
 * The same vocabulary backs case tags (tutoring_cases.tags): a case
 * stores up to five tags drawn from the parent's picks plus the derived
 * requirement tags.
 *
 * Rules from the issues:
 * - cap of five tags per card and per case;
 * - a tag that is (or carries) a phone number, email, or handle is
 *   rejected — reuses the #215 contact filter;
 * - storage is lowercase, hash stripped; hyphens and underscores become
 *   a single space and repeated spaces collapse, so "IA-review",
 *   "ia_review", and "ia review" all save as "ia review" (#311);
 * - a new tag is capped at 30 characters;
 * - a tag used by three or more tutors appears in search suggestions,
 *   with the tutor count ("ia review · 12"); a tag used by one or two
 *   tutors stays searchable but is never suggested (#311).
 */

import { hasContactDetails } from "@/lib/contact-filter";

export const MAX_PROFILE_TAGS = 5;
export const MAX_PROFILE_TAG_LENGTH = 30;

/** Seed tags shown as one-tap chips (#311). Stored normalized. */
export const PRESET_PROFILE_TAGS = [
  "examiner",
  "ia review",
  "tok",
  "ee",
  "sba",
  "oral",
  "past paper practice",
] as const;

/** Normalize free input to the stored shape: trim, strip #, lowercase,
 * hyphens/underscores → single space, spaces collapsed, 30-char cap. */
export function normalizeProfileTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, "")
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, MAX_PROFILE_TAG_LENGTH)
    .trim();
}

export type ProfileTagParseResult =
  { ok: true; tags: string[] } | { ok: false; error: "too_many" | "contact"; tag?: string };

/**
 * Validate a full tag list. Returns the clean list (normalized, deduped,
 * order kept) or why the list must not be saved. The error is a stable
 * code — the UIs translate it (settings form is bilingual; the admin
 * editor is English).
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
  // Issue #311: a tag starting with @ is a social handle — reject it even
  // though the #215 filter only names known channel words.
  const handleTag = tags.find((tag) => tag.startsWith("@"));
  if (handleTag) return { ok: false, error: "contact", tag: handleTag };
  return { ok: true, tags };
}

export type ProfileTagWithCount = { tag: string; count: number };

/** Tags used by >= minCount tutors, most-used first (search suggestions). */
export function popularProfileTags(
  tutors: { profile_tags: string[] }[],
  minCount = 3,
): ProfileTagWithCount[] {
  const counts = new Map<string, number>();
  for (const tutor of tutors) {
    for (const tag of tutor.profile_tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= minCount)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/**
 * Merge parent-picked case tags with the auto-derived requirement tags
 * (#311: one tag table, a case stores up to five). Parent picks come
 * first, duplicates collapse, everything is normalized; derived tags
 * fill the remaining slots in their derived order.
 */
export function mergeCaseTags(parentTags: unknown, derivedTags: unknown): string[] {
  const merged: string[] = [];
  for (const raw of [...toList(parentTags), ...toList(derivedTags)]) {
    if (typeof raw !== "string") continue;
    const tag = normalizeProfileTag(raw);
    if (!tag || merged.includes(tag)) continue;
    merged.push(tag);
  }
  return merged.slice(0, MAX_PROFILE_TAGS);
}

function toList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
