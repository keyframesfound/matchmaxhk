import { contactFilterError } from "@/lib/contact-filter";

// Issue #323, Tutor Academic Profile smart headline.
// One headline per tutor, max 40 chars, auto-generated from the tutor's
// qualifications (curriculum + optional overall score) but never overwriting
// a tutor's manual edit (the form tracks an `isDirty` flag; see
// ApplicationForm.tsx).

export const MAX_ACADEMIC_HEADLINE = 40;

export interface HeadlineEntry {
  curriculum: string;
  /** Overall achieved score/grade, e.g. "44/45", "9A*", "32". Blank = none. */
  score?: string;
}

function truncateAtLimit(value: string): string {
  if (value.length <= MAX_ACADEMIC_HEADLINE) return value;
  // Truncate, then drop any trailing hyphens/spaces the cut left behind
  // (Rule 4). A single over-long segment still yields a clean 40-char value.
  return value
    .slice(0, MAX_ACADEMIC_HEADLINE)
    .replace(/[\s-]+$/u, "")
    .trimEnd();
}

/**
 * Build the smart-default headline from the tutor's qualifications.
 * - Rule 1: one curriculum with a score -> "[Curriculum] [Score]" ("IBDP 44/45")
 * - Rule 2: several curricula -> joined with " - " ("IBDP 44/45 - IGCSE 9A*")
 * - Rule 3: curriculum with no score -> "[Curriculum] Tutor" ("HKDSE Tutor")
 * - Rule 4: truncated to 40 chars, trailing hyphens/spaces trimmed
 * Returns "" when no curriculum is given.
 */
export function buildAcademicHeadline(entries: HeadlineEntry[]): string {
  const parts = entries
    .filter((entry) => entry.curriculum.trim())
    .map((entry) => {
      const curriculum = entry.curriculum.trim();
      const score = (entry.score ?? "").trim();
      return score ? `${curriculum} ${score}` : `${curriculum} Tutor`;
    });
  return truncateAtLimit(parts.join(" - "));
}

/**
 * Editor safe-to-overwrite check: the saved headline is auto-updatable only
 * when it EXACTLY equals what the smart default would generate today (i.e.
 * the tutor never customized it). Anything else counts as dirty.
 */
export function isDefaultHeadline(saved: string, entries: HeadlineEntry[]): boolean {
  const savedTrimmed = saved.trim();
  if (!savedTrimmed) return false;
  return savedTrimmed === buildAcademicHeadline(entries);
}

/** Validation shared by the join form and the profile editor. */
export function academicHeadlineError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Required";
  if (trimmed.length > MAX_ACADEMIC_HEADLINE) {
    return `Keep the headline to ${MAX_ACADEMIC_HEADLINE} characters or fewer`;
  }
  return contactFilterError(trimmed);
}
