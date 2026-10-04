/**
 * Education (university / secondary school / major) helpers shared by the
 * public tutor directory filters and the admin + self-serve editors.
 *
 * The tutors table stores education as free text (intake form). Filter
 * dropdowns are built from the distinct values that actually appear on tutor
 * profiles (collected at render time), and matching is an exact, case- and
 * whitespace-collapsed equality — the same semantics the major filter has
 * always used (issue #23).
 */

/** Structural view of the free-text education columns on a tutors row. */
export type EducationValueRow = {
  undergrad_university?: string | null;
  postgrad_university?: string | null;
  secondary_school?: string | null;
  undergrad_degree?: string | null;
  postgrad_degree?: string | null;
};

export type EducationValueSets = {
  universities: string[];
  highSchools: string[];
  majors: string[];
};

export type EducationTexts = {
  undergradUniversity?: string | null;
  postgradUniversity?: string | null;
  secondarySchool?: string | null;
};

const collapse = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

/** Distinct trimmed values, deduped case-insensitively, most frequent first. */
export function distinctEducationValues(values: Array<string | null | undefined>): string[] {
  const counts = new Map<string, { value: string; count: number }>();
  for (const raw of values) {
    const value = raw?.trim() ?? "";
    if (!value) continue;
    const key = collapse(value);
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { value, count: 1 });
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .map((entry) => entry.value);
}

/** Distinct education values actually present on tutor profiles, for filter and editor dropdowns. */
export function collectEducationValueSets(rows: EducationValueRow[]): EducationValueSets {
  return {
    universities: distinctEducationValues(
      rows.flatMap((row) => [row.undergrad_university, row.postgrad_university]),
    ),
    highSchools: distinctEducationValues(rows.map((row) => row.secondary_school)),
    majors: distinctEducationValues(
      rows.flatMap((row) => [row.undergrad_degree, row.postgrad_degree]),
    ),
  };
}

function matchesExact(filter: string | null | undefined, texts: Array<string | null | undefined>) {
  const value = collapse(filter ?? "");
  if (!value) return true;

  const present = texts
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    .map(collapse);
  if (present.length === 0) return false;

  return present.some((text) => text === value);
}

/** True when a tutor's undergrad/postgrad university equals the filter value. */
export function matchesUniversityFilter(
  filter: string | null | undefined,
  texts: EducationTexts,
): boolean {
  return matchesExact(filter, [texts.undergradUniversity, texts.postgradUniversity]);
}

/** True when the tutor's secondary school equals the filter value. */
export function matchesHighSchoolFilter(
  filter: string | null | undefined,
  texts: EducationTexts,
): boolean {
  return matchesExact(filter, [texts.secondarySchool]);
}

/** True when a tutor's degree equals the filter value (issue #23: open list, exact match). */
export function matchesMajorFilter(
  filter: string | null | undefined,
  texts: { undergradDegree?: string | null; postgradDegree?: string | null },
): boolean {
  return matchesExact(filter, [texts.undergradDegree, texts.postgradDegree]);
}

/**
 * Issue #130 (tutor editor): canonical suggestion lists for the education
 * fields. These are suggestions, not restrictions — the editors render them
 * in a searchable dropdown with `allowCustom`, so admins and tutors can pick
 * from the list or type any other institution. Free text stored in the DB
 * keeps working with the exact filter matching above.
 */

/** Full institutional names for the HK universities. */
export const UNIVERSITY_SUGGESTIONS = [
  "The University of Hong Kong",
  "The Chinese University of Hong Kong",
  "The Hong Kong University of Science and Technology",
  "The Hong Kong Polytechnic University",
  "City University of Hong Kong",
  "Hong Kong Metropolitan University",
  "The Education University of Hong Kong",
] as const;

/** Full school names for well-known Hong Kong secondary schools. */
export const HIGH_SCHOOL_SUGGESTIONS = [
  "St. Stephen's College",
  "Diocesan Girls' School",
  "Diocesan Boys' School",
  "Chinese International School",
  "King George V School",
  "La Salle College",
  "St. Paul's Co-educational College",
  "St. Mary's Canossian College",
  "Wah Yan College, Hong Kong",
  "Wah Yan College, Kowloon",
  "Sha Tin College",
  "South Island School",
  "West Island School",
  "Island School",
  "Queen Elizabeth School",
] as const;

/** Common HK programme names surfaced as editor suggestions (majors are an open list). */
export const MAJOR_SUGGESTIONS = [
  "Bachelor of Engineering in Computer Engineering",
  "Bachelor of Engineering in Mechanical Engineering",
  "Bachelor of Science in Computer Science",
  "Bachelor of Science in Mathematics",
  "Bachelor of Science in Physics",
  "Bachelor of Science in Biochemistry",
  "Bachelor of Business Administration",
  "Bachelor of Arts in English",
  "LLB Bachelor of Laws",
  "MBBS Medicine",
] as const;

/**
 * Options for an education editor dropdown: the current value first (so edits
 * never fight the list), then values already in use on tutor profiles, then
 * the canonical suggestions — deduped case-insensitively.
 */
export function educationEditorOptions(
  currentValue: string | null | undefined,
  suggestions: readonly string[],
  dbValues: readonly string[] = [],
): string[] {
  const seen = new Set<string>();
  const options: string[] = [];
  const push = (raw: string) => {
    const value = raw.trim();
    const key = collapse(value);
    if (!key || seen.has(key)) return;
    seen.add(key);
    options.push(value);
  };
  push(currentValue ?? "");
  for (const value of dbValues) push(value);
  for (const value of suggestions) push(value);
  return options;
}

/** Options for the editor's university dropdown. */
export function universityEditorOptions(
  currentValue: string | null | undefined,
  dbValues: readonly string[] = [],
): string[] {
  return educationEditorOptions(currentValue, UNIVERSITY_SUGGESTIONS, dbValues);
}

/** Options for the editor's secondary-school dropdown. */
export function highSchoolEditorOptions(
  currentValue: string | null | undefined,
  dbValues: readonly string[] = [],
): string[] {
  return educationEditorOptions(currentValue, HIGH_SCHOOL_SUGGESTIONS, dbValues);
}

/** Options for the editor's major dropdown. */
export function majorEditorOptions(
  currentValue: string | null | undefined,
  dbValues: readonly string[] = [],
): string[] {
  return educationEditorOptions(currentValue, MAJOR_SUGGESTIONS, dbValues);
}

/**
 * Issue #130: when the pedigree filters alone zero out the results, the
 * directory shows a fallback list of elite-pedigree tutors. Elite means an
 * overseas/ONG institution, or HKU / CUHK / HKUST. This is a display
 * heuristic only — it is not exposed as a filter option.
 */

/** Matching substrings (lowercased) per listed HK university. */
const HK_UNIVERSITY_MATCHERS: Record<string, string[]> = {
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
};

function matchesBucket(matchers: string[], texts: string[]): boolean {
  return matchers.some((needle) =>
    texts.some((text) => text.includes(needle) || needle.includes(text)),
  );
}

export function isElitePedigree(texts: EducationTexts): boolean {
  const universityTexts = [texts.undergradUniversity, texts.postgradUniversity]
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    .map(collapse);
  if (universityTexts.length === 0) return false;

  const eliteMatchers = [
    ...HK_UNIVERSITY_MATCHERS.hku,
    ...HK_UNIVERSITY_MATCHERS.cuhk,
    ...HK_UNIVERSITY_MATCHERS.hkust,
  ];
  const listedHk = Object.values(HK_UNIVERSITY_MATCHERS).some((matchers) =>
    matchesBucket(matchers, universityTexts),
  );
  return matchesBucket(eliteMatchers, universityTexts) || !listedHk;
}
