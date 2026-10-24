/**
 * Issue #199, SEN (Special Educational Needs) capability vocabulary and
 * matching helpers, shared by the tutor application form, the tutor profile
 * editors, the case request form, tutor search and the tutor card badge.
 *
 * The category strings are the stored vocabulary (tutors.sen_categories and
 * tutoring_cases.sen_categories text[] values), renaming an entry here
 * without a data migration would orphan the stored rows.
 */
export const SEN_CATEGORY_OPTIONS = [
  "ADHD",
  "ASD",
  "Dyslexia/SpLD",
  "Dyspraxia",
  "Speech & Language Impairment",
  "Other",
] as const;

export type SenCategory = (typeof SEN_CATEGORY_OPTIONS)[number];

/** Tolerant read: drops unknown/blank entries, dedupes, preserves option order. */
export function normalizeSenCategories(raw: unknown): SenCategory[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(SEN_CATEGORY_OPTIONS);
  const picked = new Set<string>(
    raw.filter((value): value is string => typeof value === "string" && allowed.has(value)),
  );
  return SEN_CATEGORY_OPTIONS.filter((option) => picked.has(option));
}

/**
 * Issue #199 filter semantics: the tutor must have SEN experience enabled AND
 * carry EVERY selected filter category (match-all, a parent picking two
 * categories wants tutors tagged with both). An empty selection matches any
 * SEN-enabled tutor. Tutors with sen_enabled but no categories still satisfy
 * the plain "SEN experience" toggle but never a specific category pick.
 */
export function matchesSenFilter(
  selectedCategories: string[],
  tutor: Pick<TutorSenFields, "sen_enabled" | "sen_categories">,
): boolean {
  if (tutor.sen_enabled !== true) return false;
  const owned = new Set(tutor.sen_categories ?? []);
  return selectedCategories.every((category) => owned.has(category));
}

/** Shape shared by Tutor rows and the form drafts that feed them. */
export type TutorSenFields = {
  sen_enabled: boolean;
  sen_categories: string[];
  sen_experience: string | null;
};
