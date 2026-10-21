/**
 * Issue #190 (case slice) — pure helpers that map the level-first case
 * request funnel onto the tutoring_cases vertical columns
 * (academic_tier, uni_field, uni_name, uni_program, uni_course_codes,
 * kindergarten_focus). Server fns and forms both import these so the
 * tier derivation and payload shaping live in one tested place.
 */

import {
  normalizeAcademicTier,
  normalizeKindergartenTopics,
  type AcademicTier,
  type KindergartenTopic,
} from "@/features/tutors/verticals";
import { sanitizeCaseFreeText } from "@/lib/contact-filter";

// The four funnel options shown as the first question of step 1.
// "Secondary" stays a UI-level choice: the stored student_level keeps the
// legacy junior/senior vocabulary via secondaryBand.
export const FUNNEL_LEVELS = ["Kindergarten", "Primary", "Secondary", "University"] as const;

export type FunnelLevel = (typeof FUNNEL_LEVELS)[number];

export const SECONDARY_BANDS = ["Junior secondary", "Senior secondary"] as const;

export type SecondaryBand = (typeof SECONDARY_BANDS)[number];

/** Tolerant read: funnel level only, else null. */
export function normalizeFunnelLevel(raw: unknown): FunnelLevel | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return (FUNNEL_LEVELS as readonly string[]).includes(value) ? (value as FunnelLevel) : null;
}

/**
 * The student_level string a funnel answer stores. Secondary needs the
 * junior/senior band before a level exists; every other level maps 1:1.
 */
export function storedStudentLevel(
  level: FunnelLevel | null | undefined,
  secondaryBand?: string | null,
): string | null {
  switch (level) {
    case "Kindergarten":
      return "Kindergarten";
    case "Primary":
      return "Primary";
    case "University":
      return "University";
    case "Secondary":
      return (SECONDARY_BANDS as readonly string[]).includes(secondaryBand ?? "")
        ? (secondaryBand as SecondaryBand)
        : null;
    default:
      return null;
  }
}

/** Funnel answer → the academic_tier enum stored on tutoring_cases. */
export function tierForFunnelLevel(level: FunnelLevel | null | undefined): AcademicTier {
  if (level === "Kindergarten") return "kindergarten";
  if (level === "University") return "university";
  return "primary_secondary";
}

/**
 * Issue #396: the public-board uni free text (uni_field, uni_name,
 * uni_program, uni_course_codes — all whitelisted in PUBLIC_CASE_COLUMNS)
 * runs through the shared contact filter before storage. Matches are
 * STRIPPED, not rejected: the parent submit path is effectively
 * untrusted-input handling and must never 500 on a pasted phone number
 * (precedent #334), and the admin case editor stays consistent with it.
 * Strip → whitespace-collapse → strip runs to a FIXPOINT (bounded): a
 * single pass can reconstitute a number the first pass split — e.g.
 * "9123 foo@bar.com 4567" strips to "9123   4567" and collapsing the
 * whitespace stitches it into the canonical "9123 4567", so the collapse
 * output must be re-filtered before storage. Trim, cap, blank → null.
 * (Since #410 the implementation is the shared sanitizeCaseFreeText in
 * contact-filter.ts — one pipeline for every public case free-text field.)
 */
export function sanitizeCaseUniText(raw: unknown, max: number): string | null {
  return sanitizeCaseFreeText(raw, max);
}

export type CaseVerticalInput = {
  academicLevel: FunnelLevel | null | undefined;
  uniField?: unknown;
  uniName?: unknown;
  uniProgram?: unknown;
  uniCourseCodes?: unknown;
  kindergartenTopics?: unknown;
};

export type CaseVerticalInsert = {
  academic_tier: AcademicTier;
  uni_field: string | null;
  uni_name: string | null;
  uni_program: string | null;
  uni_course_codes: string | null;
  kindergarten_focus: KindergartenTopic[];
};

/**
 * Vertical column values for a case insert/update. University fields are
 * only kept for the University tier and K topics only for the Kindergarten
 * tier, so a stray payload can't park uni data on a primary case. K topics
 * run through normalizeKindergartenTopics (canonical values only, deduped,
 * option order).
 */
export function buildVerticalInsert(input: CaseVerticalInput): CaseVerticalInsert {
  const tier = tierForFunnelLevel(input.academicLevel);
  return {
    academic_tier: normalizeAcademicTier(tier) ?? "primary_secondary",
    uni_field: tier === "university" ? sanitizeCaseUniText(input.uniField, 80) : null,
    uni_name: tier === "university" ? sanitizeCaseUniText(input.uniName, 120) : null,
    uni_program: tier === "university" ? sanitizeCaseUniText(input.uniProgram, 120) : null,
    uni_course_codes:
      tier === "university" ? sanitizeCaseUniText(input.uniCourseCodes, 2000) : null,
    kindergarten_focus:
      tier === "kindergarten" ? normalizeKindergartenTopics(input.kindergartenTopics) : [],
  };
}
