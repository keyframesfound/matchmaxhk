import { matchesCategoryFilter, matchesSubjectQuery } from "../tutors/subjects";
import { parseSelectedStatuses, tutorMatchesStatusFilter } from "../tutors/status-taxonomy";

/**
 * #725 slice 2: does a newly published tutor / case match a saved search?
 * Pure (no DB) so the bus matcher and vitest share one definition. It mirrors
 * the core /tutors and case-board filters; anything the matcher does not
 * understand is ignored (soft), never a reason to drop an alert.
 */

export type MatchParams = Record<string, unknown>;

export type MatchableTutor = {
  subjects: string[];
  target_students: string[];
  card_highlights: string[] | null;
  tutor_status: string | null;
  lesson_mode: string | null;
  stations: string[] | null;
  gender: string | null;
  verification_tier: string | null;
  tutor_code: string;
  display_name: string | null;
};

export type MatchableCase = {
  subjects: string[] | null;
  exam_system: string | null;
  district: string | null;
  mode: string | null;
  title: string | null;
  case_code: string;
};

const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

function subjectList(params: MatchParams): string[] {
  return [str(params.subject), ...str(params.subjects_extra).split("||")]
    .map((value) => value.trim())
    .filter(Boolean);
}

export function tutorMatchesSavedSearch(params: MatchParams, tutor: MatchableTutor): boolean {
  const category = str(params.category).toLowerCase();
  if (
    category &&
    !matchesCategoryFilter(category, tutor.subjects, [
      ...tutor.target_students,
      ...(tutor.card_highlights ?? []),
    ])
  ) {
    return false;
  }

  const subjects = subjectList(params).map((value) => value.toLowerCase());
  if (subjects.length > 0) {
    const hits = subjects.filter((wanted) =>
      tutor.subjects.some((own) => matchesSubjectQuery(own, wanted)),
    ).length;
    if (str(params.subject_match) === "and" ? hits < subjects.length : hits === 0) return false;
  }

  const statuses = parseSelectedStatuses(str(params.status), str(params.statuses_extra));
  if (statuses.length > 0 && !tutorMatchesStatusFilter(tutor.tutor_status, statuses)) return false;

  const mode = str(params.mode);
  if (mode === "online" || mode === "in_person") {
    const offers = tutor.lesson_mode ?? "either";
    if (offers !== "either" && offers !== mode) return false;
    const station = str(params.station);
    if (mode === "in_person" && station && !(tutor.stations ?? []).includes(station)) return false;
  }

  const gender = str(params.gender);
  if (gender && tutor.gender !== gender) return false;

  if (params.verified === true && tutor.verification_tier !== "tier_2_verified") return false;

  const q = str(params.q).toLowerCase();
  if (q) {
    const haystack = [
      tutor.tutor_code,
      tutor.display_name ?? "",
      ...tutor.subjects,
      ...(tutor.card_highlights ?? []),
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

/** Legacy board `?category=` key for a case exam system (mirrors the board). */
function caseSectionKey(examSystem: string | null): string {
  const value = examSystem?.trim();
  if (!value || value === "Other") return "Other";
  if (value === "Local Primary" || value === "Int'l Primary") return "Primary School";
  return value;
}

export function caseMatchesSavedSearch(params: MatchParams, item: MatchableCase): boolean {
  const category = str(params.category);
  if (category && caseSectionKey(item.exam_system) !== category) return false;
  const subject = str(params.subject);
  if (subject && !(item.subjects ?? []).includes(subject)) return false;
  const district = str(params.district);
  if (district && item.district !== district) return false;
  const mode = str(params.mode);
  if (mode === "online" && item.mode === "in_person") return false;
  if (mode === "in_person" && item.mode === "online") return false;
  const q = str(params.q).toLowerCase();
  if (q) {
    const haystack = [
      item.case_code,
      item.title ?? "",
      ...(item.subjects ?? []),
      item.district ?? "",
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}
