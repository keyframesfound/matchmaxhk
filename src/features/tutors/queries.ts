import { supabase } from "@/integrations/supabase/client";
import { normalizeExamResults, type ExamResult } from "./examSystems";

export type Education = {
  institution: string;
  qualification: string;
  year?: number | null;
  level?: string | null;
};

export const MAX_TUTOR_ACHIEVEMENTS = 3;
export const TUTOR_ACHIEVEMENT_SHORT_TEXT_LIMIT = 60;
export const IA_EE_TOK_SUPPORT_OPTIONS = ["IA", "EE", "TOK"] as const;

export type TutorAchievement = {
  short_text: string;
  detail_text?: string;
};

export type IaEeTokSupport = (typeof IA_EE_TOK_SUPPORT_OPTIONS)[number];

export type Tutor = {
  id: string;
  display_name: string;
  headline: string | null;
  university: string | null;
  highschool: string | null;
  target_students: string[];
  academic_summary: string | null;
  qualifications_summary: string | null;
  subjects: string[];
  district: string | null;
  gender: string | null;
  lesson_mode: "online" | "in_person" | "either";
  hourly_rate: number;
  badge: string | null;
  bio: string | null;
  photo_url: string | null;
  tutor_code: string;
  is_published: boolean;
  education: Education[];
  experience_years: number | null;
  teaching_since: number | null;
  languages: string[];
  exam_results: ExamResult[];
  achievements: TutorAchievement[];
  ia_ee_tok_support: IaEeTokSupport[];
  ia_ee_tok_notes: string | null;
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
  "id, display_name, headline, university, highschool, target_students, academic_summary, qualifications_summary, subjects, district, lesson_mode, hourly_rate, badge, bio, photo_url, tutor_code, is_published, education, experience_years, teaching_since, languages, exam_results, achievements, ia_ee_tok_support, ia_ee_tok_notes, gender";

const LEGACY_SELECT_COLS =
  "id, display_name, headline, subjects, district, lesson_mode, hourly_rate, badge, bio, photo_url, tutor_code, is_published, education, experience_years, teaching_since, languages, exam_results, achievements, ia_ee_tok_support, ia_ee_tok_notes, gender";

function hasMissingProfileColumns(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: unknown; message?: unknown };
  const code = typeof maybe.code === "string" ? maybe.code : "";
  const message = typeof maybe.message === "string" ? maybe.message : "";
  return (
    code === "42703" ||
    /column\s+"?(university|highschool|target_students|academic_summary|qualifications_summary|achievements|ia_ee_tok_support|ia_ee_tok_notes)"?\s+does\s+not\s+exist/i.test(
      message,
    )
  );
}

async function withTutorSelectFallback<T>(
  run: (selectCols: string) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T> {
  const first = await run(SELECT_COLS);
  if (!first.error) return (first.data ?? []) as T;

  if (!hasMissingProfileColumns(first.error)) {
    throw first.error;
  }

  const second = await run(LEGACY_SELECT_COLS);
  if (second.error) throw second.error;
  return (second.data ?? []) as T;
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
  const edu = Array.isArray(row.education) ? (row.education as Education[]) : [];
  const exams = normalizeExamResults(row.exam_results);
  const targetStudents = Array.isArray(row.target_students)
    ? (row.target_students as unknown[]).filter(
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
    university: typeof row.university === "string" ? row.university : null,
    highschool: typeof row.highschool === "string" ? row.highschool : null,
    academic_summary: typeof row.academic_summary === "string" ? row.academic_summary : null,
    qualifications_summary:
      typeof row.qualifications_summary === "string" ? row.qualifications_summary : null,
    education: edu,
    exam_results: exams,
    achievements: normalizeAchievements(row.achievements),
    ia_ee_tok_support: normalizeIaEeTokSupport(row.ia_ee_tok_support),
    ia_ee_tok_notes: typeof row.ia_ee_tok_notes === "string" ? row.ia_ee_tok_notes : null,
    target_students: targetStudents,
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
  const data = await withTutorSelectFallback<Record<string, unknown>[]>((selectCols) =>
    supabase
      .from("tutors")
      .select(selectCols)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(limit),
  );
  return (data ?? []).map((row) => normalize(row, defaults));
}

export async function fetchPublishedTutors(): Promise<Tutor[]> {
  const defaults = await fetchTutorPhotoDefaults();
  const data = await withTutorSelectFallback<Record<string, unknown>[]>((selectCols) =>
    supabase
      .from("tutors")
      .select(selectCols)
      .eq("is_published", true)
      .order("created_at", { ascending: false }),
  );
  return (data ?? []).map((row) => normalize(row, defaults));
}

export async function fetchAllTutors(): Promise<Tutor[]> {
  const defaults = await fetchTutorPhotoDefaults();
  const data = await withTutorSelectFallback<Record<string, unknown>[]>((selectCols) =>
    supabase.from("tutors").select(selectCols).order("created_at", { ascending: false }),
  );
  return (data ?? []).map((row) => normalize(row, defaults));
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

export function getTutorLocationLabel(tutor: Pick<Tutor, "district" | "lesson_mode">): string {
  if (tutor.lesson_mode === "online") return "Online";
  if (tutor.lesson_mode === "in_person") return tutor.district ?? "In person";
  return tutor.district ? `${tutor.district} · Online & in-person` : "Online & in-person";
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

export async function fetchLandingStats(): Promise<{
  activeTutors: number;
  subjectsCovered: number;
}> {
  const { data, error } = await supabase.from("tutors").select("subjects").eq("is_published", true);
  if (error) throw error;
  const rows = (data ?? []) as { subjects: string[] | null }[];
  const set = new Set<string>();
  for (const r of rows) {
    for (const s of r.subjects ?? []) {
      const v = (s ?? "").trim();
      if (v) set.add(v);
    }
  }
  return { activeTutors: rows.length, subjectsCovered: set.size };
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
