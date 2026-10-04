import { supabase } from "@/integrations/supabase/client";
import { isTutorPubliclyListed } from "./tutor-display";
import { normalizeExamResults, type ExamResult } from "./examSystems";
import type { TutorReview } from "./tutor-reviews";
import type { EducationValueRow } from "./education-filters";

export const MAX_TUTOR_ACHIEVEMENTS = 3;
export const TUTOR_ACHIEVEMENT_SHORT_TEXT_LIMIT = 60;
export const MAX_TUTOR_CARD_HIGHLIGHTS = 3;
export const TUTOR_CARD_HIGHLIGHT_ROW_LIMIT = 55;
export const IA_EE_TOK_SUPPORT_OPTIONS = ["IA", "EE", "TOK"] as const;

export type TutorAchievement = {
  short_text: string;
  detail_text?: string;
};

/** One per-curriculum hourly rate, e.g. { curriculum: "DSE", rate: 400 }. */
export type PricingTier = {
  curriculum: string;
  rate: number;
};

export const MAX_PRICING_TIERS = 8;
export const PRICING_TIER_CURRICULUM_LIMIT = 80;

export function normalizePricingTiers(raw: unknown): PricingTier[] {
  if (!Array.isArray(raw)) return [];

  const tiers: PricingTier[] = [];
  const seen = new Set<string>();
  for (const value of raw.slice(0, MAX_PRICING_TIERS * 2)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const entry = value as Record<string, unknown>;
    const curriculum = typeof entry.curriculum === "string" ? entry.curriculum.trim() : "";
    const rate = typeof entry.rate === "number" ? entry.rate : Number(entry.rate);
    if (!curriculum || !Number.isFinite(rate) || rate < 0) continue;
    const key = curriculum.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tiers.push({
      curriculum: curriculum.slice(0, PRICING_TIER_CURRICULUM_LIMIT),
      rate: Math.round(rate),
    });
    if (tiers.length >= MAX_PRICING_TIERS) break;
  }
  return tiers;
}

export function normalizeTutorCardHighlights(
  raw: unknown,
  legacyHeadline: unknown = null,
): string[] {
  const values = Array.isArray(raw)
    ? raw
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim().slice(0, TUTOR_CARD_HIGHLIGHT_ROW_LIMIT))
        .filter(Boolean)
    : [];
  if (values.length > 0) {
    return values.slice(0, MAX_TUTOR_CARD_HIGHLIGHTS);
  }

  const legacy = typeof legacyHeadline === "string" ? legacyHeadline.trim() : "";
  if (!legacy) return [];

  return legacy
    .split(/\r?\n|\s*\|\s*/)
    .map((value) => value.trim().slice(0, TUTOR_CARD_HIGHLIGHT_ROW_LIMIT))
    .filter(Boolean)
    .slice(0, MAX_TUTOR_CARD_HIGHLIGHTS);
}

export function getTutorCardHighlights(
  tutor: Pick<Tutor, "card_highlights" | "headline">,
): string[] {
  return normalizeTutorCardHighlights(tutor.card_highlights, tutor.headline);
}

export type IaEeTokSupport = (typeof IA_EE_TOK_SUPPORT_OPTIONS)[number];

/** Issue #103: macro availability windows (tutor self-serve). */
export const PREFERRED_TIME_WINDOWS = [
  "weekday_afternoon",
  "weekday_evening",
  "weekend_morning",
  "weekend_afternoon",
] as const;

export type PreferredTimeWindow = (typeof PREFERRED_TIME_WINDOWS)[number];

export function normalizePreferredTimeWindows(raw: unknown): PreferredTimeWindow[] {
  if (!Array.isArray(raw)) return [];
  const supported = new Set<string>(PREFERRED_TIME_WINDOWS);
  return Array.from(
    new Set(
      raw.filter((value): value is string => typeof value === "string" && supported.has(value)),
    ),
  ) as PreferredTimeWindow[];
}

/**
 * Issue #103: a tutor is fully booked when they flipped accepting-students
 * off, or burned through their open slots. Treated as not booked when the
 * columns are missing entirely (pre-migration rows).
 */
export function isTutorFullyBooked(
  tutor: Pick<Tutor, "is_accepting_students" | "remaining_student_slots">,
): boolean {
  if (tutor.is_accepting_students === false) return true;
  if (tutor.remaining_student_slots === null || tutor.remaining_student_slots === undefined)
    return false;
  return tutor.remaining_student_slots <= 0;
}

export type Tutor = {
  id: string;
  display_name: string;
  headline: string | null;
  card_highlights: string[];
  academic_headline: string | null;
  undergrad_university: string | null;
  undergrad_degree: string | null;
  undergrad_graduation_year: string | null;
  has_postgrad: boolean;
  postgrad_university: string | null;
  postgrad_degree: string | null;
  secondary_school: string | null;
  target_students: string[];
  qualifications_summary: string | null;
  self_introduction: string | null;
  subjects: string[];
  district: string | null;
  stations: string[];
  gender: string | null;
  tutor_status: string | null;
  /** Issue #142: tier_2_verified = transcripts + HKID passed manual review. */
  verification_tier: string | null;
  lesson_mode: "online" | "in_person" | "either";
  hourly_rate: number;
  pricing_tiers: PricingTier[];
  photo_url: string | null;
  tutor_code: string;
  is_published: boolean;
  start_immediately: boolean | null;
  earliest_start_date: string | null;
  created_at: string;
  experience_years: number | null;
  languages: string[];
  exam_results: ExamResult[];
  achievements: TutorAchievement[];
  ia_ee_tok_support: IaEeTokSupport[];
  ia_ee_tok_notes: string | null;
  /** Issue #103: self-serve capacity & macro availability windows. */
  remaining_student_slots: number | null;
  is_accepting_students: boolean | null;
  preferred_time_windows: PreferredTimeWindow[];
  /** Issue #116: self-serve weekly availability grid (raw JSONB, parsed downstream). */
  availability_grid: unknown;
  /** Issue #97: Trophy Cabinet public portfolio photo URLs; empty = hidden. */
  portfolio_images: string[];
};

export type TutorPhotoDefaults = {
  male: string | null;
  female: string | null;
};

const TUTOR_PROFILE_DEFAULT_KEYS = [
  "default_tutor_profile_photo_male",
  "default_tutor_profile_photo_female",
] as const;

const SELECT_COLS =
  "id, display_name, headline, card_highlights, academic_headline, undergrad_university, undergrad_degree, undergrad_graduation_year, has_postgrad, postgrad_university, postgrad_degree, secondary_school, target_students, qualifications_summary, self_introduction, subjects, district, stations, lesson_mode, hourly_rate, pricing_tiers, photo_url, tutor_code, is_published, start_immediately, earliest_start_date, created_at, experience_years, languages, exam_results, achievements, ia_ee_tok_support, ia_ee_tok_notes, gender, tutor_status, verification_tier, remaining_student_slots, is_accepting_students, preferred_time_windows, availability_grid, portfolio_images";

const MISSING_COLUMN_RE = /column\s+(?:[a-z_]+\.)?"?([a-z_]+)"?\s+does\s+not\s+exist/i;

function extractMissingColumn(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const maybe = error as { code?: unknown; message?: unknown };
  const code = typeof maybe.code === "string" ? maybe.code : "";
  const message = typeof maybe.message === "string" ? maybe.message : "";
  if (code !== "42703" && !MISSING_COLUMN_RE.test(message)) return null;
  const match = MISSING_COLUMN_RE.exec(message);
  return match?.[1].toLowerCase() ?? null;
}

function removeSelectColumn(selectCols: string, column: string): string {
  const trimmed = column.toLowerCase();
  return selectCols
    .split(",")
    .map((c) => c.trim())
    .filter((c) => c.toLowerCase() !== trimmed)
    .join(", ");
}

/**
 * PostgREST or-filter that keeps future-scheduled tutors (issue #106) out of
 * public queries: a tutor is listed when they start immediately or their
 * earliest start date is within 30 days. Tutors starting later are excluded
 * server-side so counts and the featured rail stay accurate.
 */
function publicAvailabilityFilter(): string {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() + 30);
  return `start_immediately.eq.true,earliest_start_date.is.null,earliest_start_date.lte.${cutoff
    .toISOString()
    .slice(0, 10)}`;
}

const AVAILABILITY_FILTER_COLUMNS = ["start_immediately", "earliest_start_date"] as const;

async function withTutorSelectFallback<T>(
  run: (
    selectCols: string,
    availabilityFilter: string | null,
  ) => PromiseLike<{ data: unknown; error: unknown }>,
  availabilityFilter: string | null = publicAvailabilityFilter(),
): Promise<T> {
  let selectCols = SELECT_COLS;
  let filter = availabilityFilter;
  for (let i = 0; i < 24; i++) {
    const result = await run(selectCols, filter);
    if (!result.error) return (result.data ?? []) as T;

    const missing = extractMissingColumn(result.error);
    if (!missing) throw result.error;

    // Availability columns not migrated yet: degrade to is_published-only
    // listing instead of breaking every public feed.
    if (filter && (AVAILABILITY_FILTER_COLUMNS as readonly string[]).includes(missing)) {
      filter = null;
      continue;
    }

    const nextCols = removeSelectColumn(selectCols, missing);
    if (nextCols === selectCols) throw result.error;
    selectCols = nextCols;
  }
  throw new Error("Too many missing tutor columns");
}

async function fetchTutorPhotoDefaults(): Promise<TutorPhotoDefaults> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", TUTOR_PROFILE_DEFAULT_KEYS as unknown as string[]);

  if (error) throw error;

  const defaults: TutorPhotoDefaults = { male: null, female: null };
  for (const row of data ?? []) {
    const value = row.value;
    if (typeof value === "string" && value.trim()) {
      if (row.key === "default_tutor_profile_photo_male") defaults.male = value.trim();
      if (row.key === "default_tutor_profile_photo_female") defaults.female = value.trim();
    }
  }
  return defaults;
}

function resolveTutorPhotoUrl(
  row: Pick<Tutor, "photo_url" | "gender">,
  defaults: TutorPhotoDefaults,
): string | null {
  const photoUrl = typeof row.photo_url === "string" ? row.photo_url.trim() : "";
  if (photoUrl) return photoUrl;

  const gender = (row.gender ?? "").toLowerCase();
  if (gender === "male") return defaults.male;
  if (gender === "female") return defaults.female;
  return null;
}

function normalizeAchievements(raw: unknown): TutorAchievement[] {
  if (!Array.isArray(raw)) return [];

  return raw.slice(0, MAX_TUTOR_ACHIEVEMENTS).flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const entry = value as Record<string, unknown>;
    const shortText = typeof entry.short_text === "string" ? entry.short_text.trim() : "";
    const detailText = typeof entry.detail_text === "string" ? entry.detail_text.trim() : "";
    if (!shortText) return [];
    return [
      {
        short_text: shortText.slice(0, TUTOR_ACHIEVEMENT_SHORT_TEXT_LIMIT),
        ...(detailText ? { detail_text: detailText } : {}),
      },
    ];
  });
}

function normalizeIaEeTokSupport(raw: unknown): IaEeTokSupport[] {
  if (!Array.isArray(raw)) return [];
  const supported = new Set<string>(IA_EE_TOK_SUPPORT_OPTIONS);
  return Array.from(
    new Set(
      raw.filter((value): value is string => typeof value === "string" && supported.has(value)),
    ),
  ) as IaEeTokSupport[];
}

function normalize(
  row: Record<string, unknown>,
  defaults: TutorPhotoDefaults = { male: null, female: null },
): Tutor {
  const exams = normalizeExamResults(row.exam_results);
  const targetStudents = Array.isArray(row.target_students)
    ? (row.target_students as unknown[]).filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0,
      )
    : [];
  const stations = Array.isArray(row.stations)
    ? (row.stations as unknown[]).filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0,
      )
    : [];

  const resolvedPhotoUrl = resolveTutorPhotoUrl(
    {
      photo_url: typeof row.photo_url === "string" ? row.photo_url : null,
      gender: typeof row.gender === "string" ? row.gender : null,
    },
    defaults,
  );

  return {
    ...(row as unknown as Tutor),
    photo_url: resolvedPhotoUrl,
    card_highlights: normalizeTutorCardHighlights(row.card_highlights, row.headline),
    academic_headline: typeof row.academic_headline === "string" ? row.academic_headline : null,
    undergrad_university:
      typeof row.undergrad_university === "string" ? row.undergrad_university : null,
    undergrad_degree: typeof row.undergrad_degree === "string" ? row.undergrad_degree : null,
    undergrad_graduation_year:
      typeof row.undergrad_graduation_year === "string" ? row.undergrad_graduation_year : null,
    has_postgrad: typeof row.has_postgrad === "boolean" ? row.has_postgrad : false,
    postgrad_university:
      typeof row.postgrad_university === "string" ? row.postgrad_university : null,
    postgrad_degree: typeof row.postgrad_degree === "string" ? row.postgrad_degree : null,
    secondary_school: typeof row.secondary_school === "string" ? row.secondary_school : null,
    qualifications_summary:
      typeof row.qualifications_summary === "string" ? row.qualifications_summary : null,
    exam_results: exams,
    achievements: normalizeAchievements(row.achievements),
    pricing_tiers: normalizePricingTiers(row.pricing_tiers),
    ia_ee_tok_support: normalizeIaEeTokSupport(row.ia_ee_tok_support),
    ia_ee_tok_notes: typeof row.ia_ee_tok_notes === "string" ? row.ia_ee_tok_notes : null,
    tutor_status: typeof row.tutor_status === "string" ? row.tutor_status : null,
    verification_tier: typeof row.verification_tier === "string" ? row.verification_tier : null,
    start_immediately: typeof row.start_immediately === "boolean" ? row.start_immediately : null,
    earliest_start_date:
      typeof row.earliest_start_date === "string" ? row.earliest_start_date : null,
    target_students: targetStudents,
    stations,
    remaining_student_slots:
      typeof row.remaining_student_slots === "number"
        ? Math.max(0, Math.round(row.remaining_student_slots))
        : null,
    is_accepting_students:
      typeof row.is_accepting_students === "boolean" ? row.is_accepting_students : null,
    preferred_time_windows: normalizePreferredTimeWindows(row.preferred_time_windows),
    availability_grid: row.availability_grid ?? null,
    // Issue #97: Trophy Cabinet URLs; tolerate missing column pre-migration.
    portfolio_images: Array.isArray(row.portfolio_images)
      ? row.portfolio_images.filter((url): url is string => typeof url === "string" && url !== "")
      : [],
  };
}

export function getTutorGenderLabel(gender: string | null | undefined): string {
  const normalized = (gender ?? "").toLowerCase();
  if (normalized === "male") return "Male";
  if (normalized === "female") return "Female";
  if (normalized === "other") return "Other";
  return "";
}

export async function fetchTopWeeklyTutors(limit = 3): Promise<Tutor[]> {
  const defaults = await fetchTutorPhotoDefaults();
  const data = await withTutorSelectFallback<Record<string, unknown>[]>(
    (selectCols, availabilityFilter) => {
      let query = supabase.from("tutors").select(selectCols).eq("is_published", true);
      if (availabilityFilter) query = query.or(availabilityFilter);
      return query.order("created_at", { ascending: false }).limit(limit);
    },
  );
  return (data ?? [])
    .map((row) => normalize(row, defaults))
    .filter((tutor) => isTutorPubliclyListed(tutor));
}

export async function fetchPublishedTutors(): Promise<Tutor[]> {
  const defaults = await fetchTutorPhotoDefaults();
  const data = await withTutorSelectFallback<Record<string, unknown>[]>(
    (selectCols, availabilityFilter) => {
      let query = supabase.from("tutors").select(selectCols).eq("is_published", true);
      if (availabilityFilter) query = query.or(availabilityFilter);
      return query.order("created_at", { ascending: false });
    },
  );
  return (data ?? [])
    .map((row) => normalize(row, defaults))
    .filter((tutor) => isTutorPubliclyListed(tutor));
}

export async function fetchAllTutors(): Promise<Tutor[]> {
  const defaults = await fetchTutorPhotoDefaults();
  const data = await withTutorSelectFallback<Record<string, unknown>[]>((selectCols) =>
    supabase.from("tutors").select(selectCols).order("created_at", { ascending: false }),
  );
  return (data ?? []).map((row) => normalize(row, defaults));
}

/**
 * Free-text education values (published tutors' rows) used to populate the
 * editor dropdowns on the self-serve profile page — so tutors pick an
 * existing university/school/major spelling instead of typing a new variant.
 */
export async function fetchEducationValues(): Promise<EducationValueRow[]> {
  const { data, error } = await supabase
    .from("tutors")
    .select(
      "undergrad_university, postgrad_university, secondary_school, undergrad_degree, postgrad_degree",
    );
  if (error) throw error;
  return (data ?? []) as EducationValueRow[];
}

export async function fetchTutorByCode(code: string): Promise<Tutor | null> {
  const defaults = await fetchTutorPhotoDefaults();
  const data = await withTutorSelectFallback<Record<string, unknown> | null>((selectCols) =>
    supabase
      .from("tutors")
      .select(selectCols)
      .eq("tutor_code", code)
      .eq("is_published", true)
      .maybeSingle(),
  );
  return data ? normalize(data as Record<string, unknown>, defaults) : null;
}

/**
 * Issues #83 + #105 (+ reviews half of #116): published reviews for a tutor's
 * public profile. RLS scopes anon reads to published reviews on published
 * tutors; admin sees all. Degrades to an empty list if the migration hasn't
 * been applied yet (same tolerant pattern as the availability columns).
 */
export async function fetchTutorReviews(tutorId: string): Promise<TutorReview[]> {
  const { data, error } = await supabase
    .from("tutor_reviews")
    .select("id, rating, public_review, reviewer_display_name, student_grade_school, created_at")
    .eq("tutor_id", tutorId)
    .eq("is_published", true)
    .order("created_at", { ascending: false });
  if (error) {
    if (extractMissingColumn(error) || (error as { code?: string }).code === "42P01") {
      return [];
    }
    throw error;
  }
  const rows = Array.isArray(data) ? data : [];
  return rows
    .map((row) => ({
      id: typeof row.id === "string" ? row.id : "",
      rating: typeof row.rating === "number" ? Math.min(5, Math.max(1, Math.round(row.rating))) : 0,
      public_review: typeof row.public_review === "string" ? row.public_review : null,
      reviewer_display_name:
        typeof row.reviewer_display_name === "string" ? row.reviewer_display_name : "",
      student_grade_school:
        typeof row.student_grade_school === "string" ? row.student_grade_school : null,
      created_at: typeof row.created_at === "string" ? row.created_at : "",
    }))
    .filter(
      (review) => review.id !== "" && review.rating >= 1 && review.reviewer_display_name !== "",
    );
}

export function getTutorLessonModeLabel(mode: Tutor["lesson_mode"]): string {
  switch (mode) {
    case "online":
      return "Online tutoring";
    case "in_person":
      return "In-person tutoring";
    case "either":
      return "Online & in-person tutoring";
  }
}

const LOCATION_STATION_LIMIT = 3;

export function getTutorStationsText(tutor: Pick<Tutor, "district" | "stations">): string | null {
  const stationList = (tutor.stations ?? []).map((s) => s.trim()).filter(Boolean);
  if (stationList.length === 0) return tutor.district?.trim() || null;
  return `${stationList.slice(0, LOCATION_STATION_LIMIT).join(", ")}${
    stationList.length > LOCATION_STATION_LIMIT
      ? ` +${stationList.length - LOCATION_STATION_LIMIT}`
      : ""
  }`;
}

export function getTutorLocationLabel(
  tutor: Pick<Tutor, "district" | "lesson_mode" | "stations">,
): string {
  const location = getTutorStationsText(tutor) ?? "";
  if (tutor.lesson_mode === "online") return "Online";
  if (tutor.lesson_mode === "in_person") return location || "In person";
  return location ? `${location} · Online & in-person` : "Online & in-person";
}

const DISTRICT_GROUPS: Record<string, string[]> = {
  "Within Hong Kong Island": [
    "Central",
    "Sheung Wan",
    "Wan Chai",
    "Causeway Bay",
    "North Point",
    "Quarry Bay",
  ],
  "Within Kowloon": ["Tsim Sha Tsui", "Mong Kok", "Kowloon Tong", "Kowloon Bay", "Ho Man Tin"],
  "Within New Territories": [
    "Sha Tin",
    "Tai Po",
    "Tuen Mun",
    "Yuen Long",
    "Tseung Kwan O",
    "Tung Chung",
    "Discovery Bay",
  ],
};

function isDistrictGroup(value: string): boolean {
  return Object.prototype.hasOwnProperty.call(DISTRICT_GROUPS, value);
}

export function matchesLessonModeFilter(
  filterMode: string | undefined,
  tutorMode: Tutor["lesson_mode"],
): boolean {
  const mode = (filterMode ?? "").trim();
  if (!mode || mode === "either") return true;
  if (tutorMode === "either") return true;
  return tutorMode === mode;
}

export function matchesDistrictFilter(
  filterDistrict: string | undefined,
  tutorDistrict: string | null | undefined,
): boolean {
  const filter = (filterDistrict ?? "").trim();
  const tutor = (tutorDistrict ?? "").trim();

  if (!filter || filter === "Open to Discussion") return true;
  if (!tutor || tutor === "Open to Discussion") return true;
  if (filter === tutor) return true;

  if (isDistrictGroup(filter) && DISTRICT_GROUPS[filter].includes(tutor)) return true;
  if (isDistrictGroup(tutor) && DISTRICT_GROUPS[tutor].includes(filter)) return true;

  return false;
}

export function matchesStationFilter(
  filterStation: string | undefined,
  tutorStations: string[] | null | undefined,
): boolean {
  const filter = (filterStation ?? "").trim();
  if (!filter) return true;
  return (tutorStations ?? []).some((station) => (station ?? "").trim() === filter);
}

export async function fetchLandingStats(): Promise<{
  activeTutors: number;
  subjectsCovered: number;
}> {
  type LandingRow = {
    subjects: string[] | null;
    start_immediately?: boolean | null;
    earliest_start_date?: string | null;
  };

  let rows: LandingRow[];
  // Availability columns may not be migrated yet; degrade to counting every
  // published tutor rather than failing the landing page.
  const withAvailability = await supabase
    .from("tutors")
    .select("subjects, start_immediately, earliest_start_date")
    .eq("is_published", true);
  if (withAvailability.error) {
    if (!extractMissingColumn(withAvailability.error)) throw withAvailability.error;
    const fallback = await supabase.from("tutors").select("subjects").eq("is_published", true);
    if (fallback.error) throw fallback.error;
    rows = (fallback.data ?? []) as LandingRow[];
  } else {
    rows = (withAvailability.data ?? []) as LandingRow[];
  }

  const visible = rows.filter((row) =>
    isTutorPubliclyListed({
      start_immediately: row.start_immediately ?? null,
      earliest_start_date: row.earliest_start_date ?? null,
    }),
  );
  const set = new Set<string>();
  for (const r of visible) {
    for (const s of r.subjects ?? []) {
      const v = (s ?? "").trim();
      if (v) set.add(v);
    }
  }
  return { activeTutors: visible.length, subjectsCovered: set.size };
}

export const HK_DISTRICTS = [
  "Open to Discussion",
  "Within Hong Kong Island",
  "Within New Territories",
  "Within Kowloon",
  "Central",
  "Sheung Wan",
  "Wan Chai",
  "Causeway Bay",
  "North Point",
  "Quarry Bay",
  "Tsim Sha Tsui",
  "Mong Kok",
  "Kowloon Tong",
  "Kowloon Bay",
  "Ho Man Tin",
  "Sha Tin",
  "Tai Po",
  "Tuen Mun",
  "Yuen Long",
  "Tseung Kwan O",
  "Tung Chung",
  "Discovery Bay",
];
