/**
 * Issues #217 + #311, Profile tags, not a feed.
 *
 * Up to five free-text tags per tutor, stored lowercase without the
 * leading "#". Shared by the admin TutorEditor, the tutor self-serve
 * profile form, the public card display, and the /tutors search filter.
 * The same vocabulary backs case tags (tutoring_cases.tags): a case
 * stores the parent's preset picks first, then the derived requirement
 * tags, capped at MAX_CASE_TAGS overall, never below the five-tag card
 * cap, so requirement tags (subjects) survive even when the parent picks
 * five presets.
 *
 * Rules from the issues:
 * - cap of five tags per tutor card; a case keeps up to MAX_CASE_TAGS
 *   (parent picks first, derived requirement tags always present);
 * - parent case tags come from the preset chips only, non-preset input
 *   is dropped, and anything that looks like a phone number, email, or
 *   handle never reaches the public board (#215 contact filter);
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

/**
 * Issue #311: cases share the tutor-tag vocabulary, but the parent's
 * optional preset picks must not crowd out the derived requirement tags
 * (subjects, component, pathway). The case cap is therefore higher than
 * the tutor-card cap; the derived tags are always kept in full and the
 * merge never shrinks a case below the tutor-card cap.
 */
export const MAX_CASE_TAGS = 8;

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
 * code, the UIs translate it (settings form is bilingual; the admin
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
  // Issue #311: a tag starting with @ is a social handle, reject it even
  // though the #215 filter only names known channel words.
  const handleTag = tags.find((tag) => tag.startsWith("@"));
  if (handleTag) return { ok: false, error: "contact", tag: handleTag };
  return { ok: true, tags };
}

export type ProfileTagWithCount = { tag: string; count: number };

/** Tags used by >= minCount tutors, most-used first (search suggestions).
 * Counts normalized spellings (legacy `ia-review` and `ia review` are one
 * tag) and dedupes per tutor so one profile can't inflate a count. */
export function popularProfileTags(
  tutors: { profile_tags: string[] }[],
  minCount = 3,
): ProfileTagWithCount[] {
  const counts = new Map<string, number>();
  for (const tutor of tutors) {
    const seen = new Set<string>();
    for (const tag of tutor.profile_tags ?? []) {
      const key = normalizeProfileTag(tag);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= minCount)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/**
 * Merge parent-picked case tags with the auto-derived requirement tags
 * (#311: one tag table). Parent preset picks come first, duplicates
 * collapse against the derived tags, everything is normalized, and the
 * result is capped at MAX_CASE_TAGS, derived requirement tags are kept
 * IN FULL, so five parent picks can never starve subjects/component/
 * pathway (the pre-#311 `buildCaseTags` cap is preserved as the floor).
 *
 * Parent input is gated exactly like `parseProfileTags` gates tutor tags
 * (#215 contact filter + `@`-handle reject) and additionally restricted
 * to the preset vocabulary: `submitCaseRequest` is unauthenticated and
 * these tags render on the public board, so free-text input is dropped.
 */
export function mergeCaseTags(parentTags: unknown, derivedTags: unknown): string[] {
  const merged: string[] = [];
  const presets = new Set<string>(PRESET_PROFILE_TAGS);
  for (const raw of toList(parentTags)) {
    if (typeof raw !== "string") continue;
    const tag = normalizeProfileTag(raw);
    // Drop anything the preset chip row could not have produced, and with
    // it any contact junk (phone/email/handle) a crafted payload carries.
    if (!tag || !presets.has(tag)) continue;
    if (!merged.includes(tag)) merged.push(tag);
  }
  const derived: string[] = [];
  for (const raw of toList(derivedTags)) {
    if (typeof raw !== "string") continue;
    const tag = normalizeProfileTag(raw);
    if (!tag || derived.includes(tag) || merged.includes(tag)) continue;
    derived.push(tag);
  }
  // Derived requirement tags always survive (they cannot exceed the cap by
  // construction, buildCaseTags emits at most MAX_CASE_TAGS); the parent
  // tail yields first, so five parent picks never drop a subject.
  const keptDerived = derived.slice(0, MAX_CASE_TAGS);
  const room = Math.max(0, MAX_CASE_TAGS - keptDerived.length);
  return [...merged.slice(0, room), ...keptDerived];
}

function toList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
