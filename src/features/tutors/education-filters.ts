/**
 * Issue #130: "University" and "Secondary/High School" filters for the parent
 * search directory. Institutional pedigree is a major selling point in the HK
 * tutoring market, so parents can narrow the directory to tutors from a
 * specific university or secondary school.
 *
 * The tutors table stores education as free text (intake form), so the filter
 * options below are canonical display buckets and matching is a tolerant
 * contains-check over the tutor's education fields — no schema change needed.
 * `overseas` is a special bucket that matches any non-empty university value
 * outside the listed HK institutions.
 */

export const UNIVERSITY_FILTER_OPTIONS = [
  "hku",
  "cuhk",
  "hkust",
  "polyu",
  "cityu",
  "hkmu",
  "eduhk",
  "overseas",
] as const;

export type UniversityFilterValue = (typeof UNIVERSITY_FILTER_OPTIONS)[number];

export const HIGH_SCHOOL_FILTER_OPTIONS = [
  "st-stephens",
  "dgs",
  "cis",
  "kgv",
  "la-salle",
  "st-pauls",
  "st-marys",
  "wah-yan",
  "sha-tin-college",
  "south-island",
  "west-island",
  "island-school",
  "hku-space-ccc-heung-yee-chung",
  "queen-elizabeth",
] as const;

export type HighSchoolFilterValue = (typeof HIGH_SCHOOL_FILTER_OPTIONS)[number];

/** Matching substrings (lowercased) per university bucket. */
const UNIVERSITY_MATCHERS: Record<UniversityFilterValue, string[]> = {
  hku: ["university of hong kong", "hku", "香港大學"],
  cuhk: ["chinese university of hong kong", "cuhk", "香港中文大學"],
  hkust: ["hong kong university of science", "hkust", "香港科技大學"],
  polyu: ["hong kong polytechnic", "polyu", "香港理工大學"],
  cityu: ["city university of hong kong", "cityu", "香港城市大學"],
  hkmu: ["hong kong metropolitan university", "hkmu", "香港都會大學"],
  eduhk: [
    "education university of hong kong",
    "eduhk",
    "hkied",
    "institute of education",
    "香港教育大學",
  ],
  overseas: [],
};

/** Matching substrings (lowercased) per secondary school bucket. */
const HIGH_SCHOOL_MATCHERS: Record<HighSchoolFilterValue, string[]> = {
  "st-stephens": [
    "st. stephen's college",
    "st stephen's college",
    "saint stephen's college",
    "聖士提反書院",
  ],
  dgs: ["diocesan girls' school", "diocesan girls school", "dgs", "拔萃女書院"],
  cis: ["chinese international school", "cis", "漢基國際學校"],
  kgv: ["king george v school", "kgv", "英皇佐治五世學校"],
  "la-salle": ["la salle college", "la salle", "喇沙書院"],
  "st-pauls": ["st. paul's", "st paul's", "saint paul's", "聖保羅"],
  "st-marys": ["st. mary's", "st mary's", "saint mary's", "聖瑪利"],
  "wah-yan": ["wah yan college", "wah yan", "華仁書院"],
  "sha-tin-college": ["sha tin college", "沙田學院"],
  "south-island": ["south island school", "港島中學"], // ESF official zh name
  "west-island": ["west island school", "西島中學"],
  "island-school": ["island school", "港島中學"], // ESF official zh name
  "hku-space-ccc-heung-yee-chung": [
    "hku space community college",
    "cccu heung yee chung",
    "heung yee chung",
    "香島專科學校",
  ],
  "queen-elizabeth": ["queen elizabeth school", "伊莉莎白中學", "伊利沙伯中學"],
};

export type EducationTexts = {
  undergradUniversity?: string | null;
  postgradUniversity?: string | null;
  secondarySchool?: string | null;
};

const collapse = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

function matchesBucket(matchers: string[], texts: string[]): boolean {
  return matchers.some((needle) =>
    texts.some((text) => text.includes(needle) || needle.includes(text)),
  );
}

/**
 * True when any of the tutor's education texts fall in the bucket. `overseas`
 * matches any non-empty university text that is NOT a listed HK institution.
 */
export function matchesUniversityFilter(
  filter: string | null | undefined,
  texts: EducationTexts,
): boolean {
  const value = (filter ?? "").trim();
  if (!value) return true;

  const universityTexts = [texts.undergradUniversity, texts.postgradUniversity]
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    .map(collapse);
  if (universityTexts.length === 0) return false;

  const bucket = value as UniversityFilterValue;
  if (bucket === "overseas") {
    const isListedHk = (text: string) =>
      (Object.keys(UNIVERSITY_MATCHERS) as UniversityFilterValue[])
        .filter((key) => key !== "overseas")
        .some((key) => matchesBucket(UNIVERSITY_MATCHERS[key], [text]));
    return universityTexts.some((text) => !isListedHk(text));
  }

  const matchers = UNIVERSITY_MATCHERS[bucket];
  if (!matchers) return true; // unknown value: do not over-filter
  return matchesBucket(matchers, universityTexts);
}

/** True when the tutor's secondary school text falls in the school bucket. */
export function matchesHighSchoolFilter(
  filter: string | null | undefined,
  texts: EducationTexts,
): boolean {
  const value = (filter ?? "").trim();
  if (!value) return true;

  const schoolTexts = [texts.secondarySchool]
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    .map(collapse);
  if (schoolTexts.length === 0) return false;

  const matchers = HIGH_SCHOOL_MATCHERS[value as HighSchoolFilterValue];
  if (!matchers) return true; // unknown value: do not over-filter
  return matchesBucket(matchers, schoolTexts);
}

/** True when ANY filter value in the comma-joined URL param matches. */
export function matchesAnyUniversityFilter(
  filter: string | null | undefined,
  texts: EducationTexts,
): boolean {
  const value = (filter ?? "").trim();
  if (!value) return true;
  return value.split(",").some((part) => matchesUniversityFilter(part, texts));
}

/** True when ANY filter value in the comma-joined URL param matches. */
export function matchesAnyHighSchoolFilter(
  filter: string | null | undefined,
  texts: EducationTexts,
): boolean {
  const value = (filter ?? "").trim();
  if (!value) return true;
  return value.split(",").some((part) => matchesHighSchoolFilter(part, texts));
}

/** Fallback list ordering for the "no exact match" empty state (issue #130):
 * elite-pedigree-first, i.e. overseas/ONG institutions before the rest. */
export function isElitePedigree(texts: EducationTexts): boolean {
  return (
    matchesUniversityFilter("overseas", texts) ||
    matchesUniversityFilter("hku", texts) ||
    matchesUniversityFilter("cuhk", texts) ||
    matchesUniversityFilter("hkust", texts)
  );
}
