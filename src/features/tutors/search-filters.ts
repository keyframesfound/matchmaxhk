import {
  getTutorCardHighlights,
  matchesDistrictFilter,
  matchesLessonModeFilter,
  matchesStationFilter,
  type Tutor,
} from "./queries";
import { matchesCategoryFilter, matchesSubjectQuery } from "./subjects";

export const PRICE_MIN = 100;
export const PRICE_MAX = 1200;
export const PRICE_STEP = 10;

export const EXPERIENCE_FILTER_VALUES = ["1", "3", "5"] as const;
export const PREFERRED_LANGUAGE_VALUES = ["English", "Cantonese", "Mandarin"] as const;

export type TutorSearchState = {
  category?: string;
  subject?: string;
  station?: string;
  mode?: string;
  gender?: string;
  district?: string;
  language?: string;
  experience?: string;
  ib_core?: string;
  min_price?: number;
  max_price?: number;
  sort?: string;
  q?: string;
};

export const formatPrice = (price: number) =>
  price >= PRICE_MAX ? `HK$${price.toLocaleString()}+` : `HK$${price.toLocaleString()}`;

export function pruneTutorSearch(search: TutorSearchState): TutorSearchState {
  const next: TutorSearchState = { ...search };
  (Object.keys(next) as (keyof TutorSearchState)[]).forEach((k) => {
    const v = next[k];
    if (v === "" || v === undefined || (typeof v === "number" && Number.isNaN(v)))
      delete next[k];
  });
  return next;
}

export function isSameTutorSearch(a: TutorSearchState, b: TutorSearchState): boolean {
  const left = pruneTutorSearch(a);
  const right = pruneTutorSearch(b);
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left[key as keyof TutorSearchState] === right[key as keyof TutorSearchState]);
}

export function matchesLanguageFilter(
  filterLanguage: string | undefined,
  tutorLanguages: string[] | null | undefined,
): boolean {
  const filter = (filterLanguage ?? "").trim().toLowerCase();
  if (!filter) return true;
  return (tutorLanguages ?? []).some(
    (language) => (language ?? "").trim().toLowerCase() === filter,
  );
}

export function matchesExperienceFilter(
  filterExperience: string | undefined,
  experienceYears: number | null | undefined,
): boolean {
  const min = Number.parseInt(filterExperience ?? "", 10);
  if (!Number.isFinite(min) || min <= 0) return true;
  return (experienceYears ?? 0) >= min;
}

export function matchesIbCoreFilter(
  filterIbCore: string | undefined,
  iaEeTokSupport: Tutor["ia_ee_tok_support"],
): boolean {
  if (!filterIbCore) return true;
  return iaEeTokSupport.length > 0;
}

export function buildLanguageOptions(tutors: Pick<Tutor, "languages">[]): string[] {
  const set = new Set<string>();
  for (const tutor of tutors) {
    for (const language of tutor.languages ?? []) {
      const value = (language ?? "").trim();
      if (value) set.add(value);
    }
  }
  const preferred: string[] = [];
  for (const value of PREFERRED_LANGUAGE_VALUES) {
    for (const item of set) {
      if (item.toLowerCase() === value.toLowerCase()) {
        preferred.push(item);
        set.delete(item);
      }
    }
  }
  return [...preferred, ...Array.from(set).sort((a, b) => a.localeCompare(b))];
}

export type ActiveFilterChip = {
  key: string;
  label: string;
  clear: Partial<TutorSearchState>;
};

export function buildActiveFilterChips(
  search: TutorSearchState,
  t: (key: string) => string,
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  const keyword = (search.q ?? "").trim();
  if (keyword) chips.push({ key: "q", label: `“${keyword}”`, clear: { q: undefined } });

  if (search.category)
    chips.push({ key: "category", label: search.category, clear: { category: undefined } });

  if (search.subject)
    chips.push({ key: "subject", label: search.subject, clear: { subject: undefined } });

  if (search.mode && search.mode !== "either")
    chips.push({
      key: "mode",
      label:
        search.mode === "online"
          ? t("search_panel.mode_online")
          : t("search_panel.mode_in_person"),
      clear: { mode: undefined, station: undefined },
    });

  if (search.mode === "in_person" && search.station)
    chips.push({ key: "station", label: search.station, clear: { station: undefined } });

  if (search.gender)
    chips.push({
      key: "gender",
      label:
        search.gender === "female"
          ? t("search_panel.gender_female")
          : search.gender === "male"
            ? t("search_panel.gender_male")
            : search.gender,
      clear: { gender: undefined },
    });

  if (search.district)
    chips.push({ key: "district", label: search.district, clear: { district: undefined } });

  if (search.language)
    chips.push({ key: "language", label: search.language, clear: { language: undefined } });

  const experienceYears = Number.parseInt(search.experience ?? "", 10);
  if (Number.isFinite(experienceYears) && experienceYears > 0)
    chips.push({
      key: "experience",
      label: `${experienceYears}+ ${t("search_panel.yrs_short")}`,
      clear: { experience: undefined },
    });

  if (search.ib_core)
    chips.push({ key: "ib_core", label: t("search_panel.ib_core"), clear: { ib_core: undefined } });

  if (search.min_price !== undefined || search.max_price !== undefined) {
    const lo = search.min_price ?? PRICE_MIN;
    const hi = search.max_price ?? PRICE_MAX;
    chips.push({
      key: "price",
      label: `${formatPrice(lo)} – ${formatPrice(hi)}`,
      clear: { min_price: undefined, max_price: undefined },
    });
  }

  return chips;
}

export function filterTutors(tutors: Tutor[], search: TutorSearchState): Tutor[] {
  const query = (search.q ?? "").trim().toLowerCase();
  const categoryFilter = (search.category ?? "").toLowerCase();
  const subjectFilter = (search.subject ?? "").toLowerCase();
  const modeFilter = search.mode ?? "";
  const genderFilter = (search.gender ?? "").toLowerCase();
  const stationFilter = modeFilter === "in_person" ? (search.station ?? "") : "";

  return tutors.filter((tutor) => {
    if (
      categoryFilter &&
      !matchesCategoryFilter(categoryFilter, tutor.subjects, [
        ...tutor.target_students,
        ...getTutorCardHighlights(tutor),
      ])
    )
      return false;
    if (subjectFilter && !tutor.subjects.some((s) => matchesSubjectQuery(s, subjectFilter)))
      return false;
    if (search.min_price !== undefined && tutor.hourly_rate < search.min_price) return false;
    if (search.max_price !== undefined && tutor.hourly_rate > search.max_price) return false;
    if (!matchesLessonModeFilter(modeFilter, tutor.lesson_mode)) return false;
    if (!matchesStationFilter(stationFilter, tutor.stations)) return false;
    if (genderFilter && (tutor.gender ?? "").toLowerCase() !== genderFilter) return false;
    if (!matchesDistrictFilter(search.district, tutor.district)) return false;
    if (!matchesLanguageFilter(search.language, tutor.languages)) return false;
    if (!matchesExperienceFilter(search.experience, tutor.experience_years)) return false;
    if (!matchesIbCoreFilter(search.ib_core, tutor.ia_ee_tok_support)) return false;
    if (
      query &&
      !(
        tutor.tutor_code.toLowerCase().includes(query) ||
        tutor.subjects.some((s) => matchesSubjectQuery(s, query)) ||
        getTutorCardHighlights(tutor).some((highlight) =>
          highlight.toLowerCase().includes(query),
        )
      )
    )
      return false;
    return true;
  });
}

export function sortTutors(tutors: Tutor[], sort: string | undefined): Tutor[] {
  return [...tutors].sort((a, b) => {
    if (sort === "price_asc")
      return a.hourly_rate - b.hourly_rate || a.tutor_code.localeCompare(b.tutor_code);
    if (sort === "price_desc")
      return b.hourly_rate - a.hourly_rate || a.tutor_code.localeCompare(b.tutor_code);
    if (sort === "newest")
      return (
        (b.created_at ?? "").localeCompare(a.created_at ?? "") ||
        a.tutor_code.localeCompare(b.tutor_code)
      );
    if (sort === "experience")
      return (
        (b.experience_years ?? 0) - (a.experience_years ?? 0) ||
        a.hourly_rate - b.hourly_rate ||
        a.tutor_code.localeCompare(b.tutor_code)
      );
    return (
      (b.experience_years ?? 0) - (a.experience_years ?? 0) ||
      a.hourly_rate - b.hourly_rate ||
      a.tutor_code.localeCompare(b.tutor_code)
    );
  });
}
