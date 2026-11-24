import { buildSearchIndex, parseQuery, scoreIndex } from "../materials/note-search";
import { matchesCategoryFilter, matchesSubjectQuery } from "../tutors/subjects";
import { parseSelectedStatuses, tutorMatchesStatusFilter } from "../tutors/status-taxonomy";

/**
 * #725 slice 2: does a newly published tutor / case / note match a saved
 * search? Pure (no DB) so the bus matcher and vitest share one definition. It
 * mirrors the core /tutors, case-board and notes-shop filters; anything the
 * matcher does not understand is ignored (soft), never a reason to drop an
 * alert.
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

/** A published digital_materials row as the notes shop sees it. */
export type MatchableNote = {
  title: string;
  summary: string | null;
  description: string | null;
  subject_tag: string | null;
  school_tag: string | null;
  curriculum_tag: string;
  subcategory: string | null;
  content_language: string | null;
  grade_achieved: string | null;
  price_hkd: number;
  material_type: string;
  topic: string | null;
  search_tags: string[] | null;
  slug: string | null;
};

const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** Shop dropdowns compare tags case-insensitively (materials-directory.tsx). */
const sameTag = (own: string | null | undefined, wanted: string): boolean =>
  (own ?? "").trim().toLowerCase() === wanted.trim().toLowerCase();

/** The shop's coursework chips: exemplars plus these sub-categories. */
const COURSEWORK_SUBCATEGORIES = new Set(["ia", "ee", "tok", "sba", "coursework"]);

/** #392 kind chips, mirrored from materials-directory.tsx matchesKind. */
function noteMatchesKind(note: MatchableNote, kind: string): boolean {
  switch (kind) {
    case "notes":
      return note.material_type === "notes" || note.material_type === "flashcards";
    case "mocks":
      return note.material_type === "mock";
    case "coursework":
      return (
        note.material_type === "exemplar" || COURSEWORK_SUBCATEGORIES.has(note.subcategory ?? "")
      );
    case "courses":
      return note.material_type === "video_course" || note.material_type === "general_course";
    case "folders":
      return note.material_type === "topic_folder";
    case "free":
      return Number(note.price_hkd) === 0;
    default:
      // "all" / absent / anything the matcher does not understand: no constraint.
      return true;
  }
}

/** The weighted document the shop's forgiving search ranks (note-search.ts). */
function noteSearchDocument(note: MatchableNote) {
  return {
    primary: [
      note.title,
      note.summary ?? "",
      note.subject_tag ?? "",
      note.topic ?? "",
      note.subcategory ? note.subcategory.replace(/_/g, " ") : "",
      ...(note.search_tags ?? []),
    ],
    secondary: [
      note.description ?? "",
      note.curriculum_tag,
      note.school_tag ?? "",
      note.material_type,
    ],
  };
}

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

/**
 * #725: does a newly published note match a saved search? Mirrors the shop
 * filters in materials-directory.tsx. Gigs are the shop's other tab, never a
 * notes alert; savedOnly / verifiedOnly need the viewer's own state, so they
 * are ignored (soft) rather than guessed.
 */
export function noteMatchesSavedSearch(params: MatchParams, note: MatchableNote): boolean {
  if (note.material_type === "gig") return false;
  if (!noteMatchesKind(note, str(params.kind).toLowerCase())) return false;

  const school = str(params.school);
  if (school && !sameTag(note.school_tag, school)) return false;
  const subject = str(params.subject);
  if (subject && !sameTag(note.subject_tag, subject)) return false;
  const curriculum = str(params.curriculum);
  if (curriculum && !sameTag(note.curriculum_tag, curriculum)) return false;
  const subcategory = str(params.subcategory);
  if (subcategory && note.subcategory !== subcategory) return false;
  const language = str(params.language);
  if (language && note.content_language !== language) return false;
  const grade = str(params.grade);
  if (grade && (note.grade_achieved ?? "").trim() !== grade) return false;

  const priceBand = str(params.priceBand).toLowerCase();
  if (priceBand === "free" && Number(note.price_hkd) !== 0) return false;
  if (priceBand === "paid" && Number(note.price_hkd) === 0) return false;

  // Shop URL uses "query"; "q" is accepted for parity with the other scopes.
  const query = str(params.query) || str(params.q);
  if (query && scoreIndex(parseQuery(query), buildSearchIndex(noteSearchDocument(note))) === 0) {
    return false;
  }
  return true;
}
