// Issue #423 ship-order step 5 — Advanced Filters for the case board.
//
// Pure functions only: URL-param parsing, the board-item predicate and the
// active-filter count. The route file and the CasesSearch components stay
// thin on top (house pattern: tutors/search-tiers.ts). Everything maps onto
// data the board item actually carries — a filter with no backing column
// (top-scorer, student grade free text) is deliberately not offered.
//
// Filter semantics on "either"-valued case fields: mode "either" accepts
// both online and in-person tutors, so it matches either mode filter;
// language "either" (no requirement) matches NO language filter — the
// English/Cantonese filters find cases that REQUIRE that language.

import { normalizeProfileTag } from "@/features/tutors/profile-tags";
import { caseAcademicTier, type AcademicTier } from "@/features/tutors/verticals";
import { caseBudgetHkdBounds } from "@/features/cases/display";
import type { PublicCaseBoardItem } from "@/lib/cases.functions";

/** Every advanced board filter, in its URL-param shape. */
export type CaseBoardFilters = {
  /** Academic tier (legacy primary/secondary rows count as primary_secondary). */
  tier?: AcademicTier;
  /** Exact subject match against the case's stored subjects. */
  subject?: string;
  /** "online" | "in_person" */
  mode?: string;
  /** package_type: "ongoing_1_5" | "short_20" | "pro_bono" */
  fee?: string;
  /** HKD rate bounds — a case matches when its budget range overlaps. */
  rate_min?: number;
  rate_max?: number;
  /** tutor_background: "uni_student" | "official_examiner" */
  background?: string;
  /** Hard tutor-gender preference on the case: "female" | "male". */
  gender?: string;
  /** Instruction-language requirement: "english" | "cantonese". */
  language?: string;
  /** SEN-friendly cases only. */
  sen?: boolean;
  /** "||"-joined requirement tags — ALL must be on the case. */
  tags?: string;
};

// --- URL-param parsing (TanStack search params arrive JSON-decoded) ---
// Absent params parse to undefined (NOT null/false) so the router never
// rewrites cold URLs with empty defaults (cold-load 307 gotcha, #190).

export function parseCaseModeParam(raw: unknown): string | undefined {
  return raw === "online" || raw === "in_person" ? raw : undefined;
}

export function parseCaseFeeParam(raw: unknown): string | undefined {
  return raw === "ongoing_1_5" || raw === "short_20" || raw === "pro_bono" ? raw : undefined;
}

export function parseCaseRateParam(raw: unknown): number | undefined {
  // "" and whitespace would Number() to 0 — treat them as absent, not zero.
  if (typeof raw === "string" && !raw.trim()) return undefined;
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isInteger(value) && value >= 0 ? value : undefined;
}

export function parseCaseBackgroundParam(raw: unknown): string | undefined {
  return raw === "uni_student" || raw === "official_examiner" ? raw : undefined;
}

export function parseCaseGenderParam(raw: unknown): string | undefined {
  return raw === "female" || raw === "male" ? raw : undefined;
}

export function parseCaseLanguageParam(raw: unknown): string | undefined {
  return raw === "english" || raw === "cantonese" ? raw : undefined;
}

/** "||"-joined tags, re-normalized through the shared tag vocabulary. */
export function parseCaseTagsParam(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const tags: string[] = [];
  for (const part of raw.split("||")) {
    const tag = normalizeProfileTag(part);
    if (tag && !tags.includes(tag)) tags.push(tag);
  }
  return tags.length > 0 ? tags.join("||") : undefined;
}

/** The draft's full tag pick. */
export function getSelectedCaseTags(filters: Pick<CaseBoardFilters, "tags">): string[] {
  return (filters.tags ?? "")
    .split("||")
    .map((tag) => normalizeProfileTag(tag))
    .filter(Boolean);
}

// --- The predicate ---

/**
 * Legacy case rows derive their tier from student_level; primary/secondary
 * levels (and anything unrecognised) fall into the default primary_secondary
 * tab, matching the tutors directory's catch-all behaviour.
 */
export function caseBoardTier(item: {
  academicTier: string | null;
  studentLevel: string;
}): AcademicTier {
  return caseAcademicTier(item.academicTier, item.studentLevel) ?? "primary_secondary";
}

const ENGLISH_TOKENS = new Set(["en", "english", "english_only"]);
const CANTONESE_TOKENS = new Set(["zh-HK", "cantonese"]);

function languageMatches(stored: string | null | undefined, filter: string): boolean {
  const value = (stored ?? "").trim();
  if (filter === "english") return ENGLISH_TOKENS.has(value);
  if (filter === "cantonese") return CANTONESE_TOKENS.has(value);
  return false;
}

export function matchesCaseFilters(
  item: Pick<
    PublicCaseBoardItem,
    | "academicTier"
    | "studentLevel"
    | "subjects"
    | "mode"
    | "packageType"
    | "budgetMin"
    | "budgetMax"
    | "budgetMinHkd"
    | "budgetMaxHkd"
    | "tutorBackground"
    | "preferredGender"
    | "languageOfInstruction"
    | "senRequired"
    | "tags"
  >,
  filters: CaseBoardFilters,
): boolean {
  if (filters.tier && caseBoardTier(item) !== filters.tier) return false;
  if (filters.subject && !item.subjects.includes(filters.subject)) return false;
  // A case open to both modes matches either filter.
  if (filters.mode === "online" && item.mode === "in_person") return false;
  if (filters.mode === "in_person" && item.mode === "online") return false;
  if (filters.fee && item.packageType !== filters.fee) return false;
  if (filters.rate_min !== undefined || filters.rate_max !== undefined) {
    const { min, max } = caseBudgetHkdBounds(item);
    // Cases with no rate at all can't satisfy a rate filter.
    if (min === null && max === null) return false;
    if (filters.rate_min !== undefined && max !== null && max < filters.rate_min) return false;
    if (filters.rate_max !== undefined && min !== null && min > filters.rate_max) return false;
  }
  if (filters.background && item.tutorBackground !== filters.background) return false;
  if (filters.gender && item.preferredGender !== filters.gender) return false;
  if (filters.language && !languageMatches(item.languageOfInstruction, filters.language))
    return false;
  if (filters.sen === true && item.senRequired !== true) return false;
  const tags = getSelectedCaseTags(filters);
  if (tags.length > 0) {
    const owned = new Set((item.tags ?? []).map((tag) => normalizeProfileTag(tag)));
    if (!tags.every((tag) => owned.has(tag))) return false;
  }
  return true;
}

/** Count for the Filters pill — only filters that live in the dialog. */
export function countCaseAdvancedFilters(filters: CaseBoardFilters): number {
  return [
    filters.tier,
    filters.fee,
    filters.background,
    filters.gender,
    filters.language,
    filters.sen === true ? "sen" : "",
    filters.rate_min !== undefined ? "rate" : "",
    filters.rate_max !== undefined ? "rate" : "",
    ...getSelectedCaseTags(filters).map(() => "tag"),
  ].filter(Boolean).length;
}
