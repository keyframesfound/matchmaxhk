/**
 * Issue #190 slice — academic-tier search helpers for the public tutor
 * directory (/tutors). Pure functions only: URL-param parsing (TanStack
 * search params arrive JSON-decoded), tier gating, keyword-haystack building
 * and kindergarten-toggle mapping. The route file and TutorsSearch components
 * stay thin on top of these.
 */

import { matchesSubjectQuery } from "./subjects";
import {
  ACADEMIC_TIERS,
  tutorTierMembership,
  type AcademicTier,
  type KindergartenFilterKey,
} from "./verticals";

// --- URL param parsing (JSON-decode tolerant, exact strings only) ---

/**
 * The `tier` search param: only the exact canonical strings are accepted
 * (?tier=university arrives as the string "university"; anything else —
 * junk, numbers, casing variants — falls back to null and the route default).
 */
export function parseTierParam(raw: unknown): AcademicTier | null {
  if (typeof raw !== "string") return null;
  return (ACADEMIC_TIERS as readonly string[]).includes(raw) ? (raw as AcademicTier) : null;
}

/**
 * Kindergarten toggle params persist as the string "true"; accept boolean
 * true too (the zod-preprocessed draft shape). Everything else is off.
 */
export function parseToggleParam(raw: unknown): boolean {
  return raw === true || raw === "true";
}

// --- Kindergarten toggles <-> URL params ---

export const KINDERGARTEN_TOGGLE_PARAMS = ["k_phonics", "k_mandarin", "k_interview"] as const;

export type KindergartenToggleParam = (typeof KINDERGARTEN_TOGGLE_PARAMS)[number];

const TOGGLE_PARAM_FOR_KEY: Record<KindergartenFilterKey, KindergartenToggleParam> = {
  phonics: "k_phonics",
  mandarin: "k_mandarin",
  interviewPrep: "k_interview",
};

/** Draft-shaped toggle values -> matchesKindergartenFilter's active map. */
export function kindergartenActiveToggles(params: {
  k_phonics?: unknown;
  k_mandarin?: unknown;
  k_interview?: unknown;
}): Partial<Record<KindergartenFilterKey, boolean>> {
  return {
    phonics: parseToggleParam(params.k_phonics) || undefined,
    mandarin: parseToggleParam(params.k_mandarin) || undefined,
    interviewPrep: parseToggleParam(params.k_interview) || undefined,
  };
}

/** Selected toggle keys -> a draft patch that writes the k_* params. */
export function kindergartenParamPatch(
  keys: KindergartenFilterKey[],
): Partial<Record<KindergartenToggleParam, boolean>> {
  const patch: Partial<Record<KindergartenToggleParam, boolean>> = {
    k_phonics: undefined,
    k_mandarin: undefined,
    k_interview: undefined,
  };
  for (const key of keys) patch[TOGGLE_PARAM_FOR_KEY[key]] = true;
  return patch;
}

// --- Tier gating ---

/** True when the tutor belongs to the given search tab (cold-start rule lives in tutorTierMembership). */
export function matchesTierFilter(tier: AcademicTier, targetStudents: string[]): boolean {
  return tutorTierMembership(targetStudents).has(tier);
}

// --- University tab ---

/** Field-of-study text-contains match over the tutor's degree fields. */
export function matchesFieldOfStudyFilter(
  field: string | null | undefined,
  texts: { undergradDegree?: string | null; postgradDegree?: string | null },
): boolean {
  const needle = (field ?? "").trim().toLowerCase();
  if (!needle) return true;
  return [texts.undergradDegree, texts.postgradDegree].some(
    (text) => typeof text === "string" && text.toLowerCase().includes(needle),
  );
}

/**
 * Keyword match over subjects (+ course codes on the university tab):
 * subjects go through matchesSubjectQuery, extraTexts (e.g.
 * universityCourseTexts) ride the same haystack so "ECON1210" finds tutors
 * carrying that course tag.
 */
export function matchesKeywordHaystack(
  query: string,
  subjects: string[],
  extraTexts: string[] = [],
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [...subjects, ...extraTexts].some((text) => matchesSubjectQuery(text, normalized));
}

// --- Tier switching ---

/** Vertical-specific params cleared when the user switches search tab. */
export const TIER_VERTICAL_PARAM_KEYS = [
  "category",
  "subjects_extra",
  "university",
  "high_school",
  "major",
  "field",
  "k_phonics",
  "k_mandarin",
  "k_interview",
] as const;

export type TierVerticalParamKey = (typeof TIER_VERTICAL_PARAM_KEYS)[number];

/**
 * Patch applied when the tier changes: clears the vertical-specific filters
 * (each tab renders its own) and carries the new tier. q / subject and the
 * generic filters (mode, price, gender, …) survive where sensible.
 */
export function tierSwitchPatch(
  next: AcademicTier,
): { tier: AcademicTier } & Record<TierVerticalParamKey, undefined> {
  const cleared = Object.fromEntries(
    TIER_VERTICAL_PARAM_KEYS.map((key) => [key, undefined]),
  ) as Record<TierVerticalParamKey, undefined>;
  return { ...cleared, tier: next };
}
