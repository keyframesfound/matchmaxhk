import { supabase } from "@/integrations/supabase/client";
import { normalizeExamResults, type ExamResult } from "./examSystems";

export type Education = {
  institution: string;
  qualification: string;
  year?: number | null;
  level?: string | null;
};

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
  intro_video_url: string | null;
  exam_results: ExamResult[];
};

const SELECT_COLS =
  "id, display_name, headline, university, highschool, target_students, academic_summary, qualifications_summary, subjects, district, lesson_mode, hourly_rate, badge, bio, photo_url, tutor_code, is_published, education, experience_years, teaching_since, languages, intro_video_url, exam_results, gender";

const LEGACY_SELECT_COLS =
  "id, display_name, headline, subjects, district, lesson_mode, hourly_rate, badge, bio, photo_url, tutor_code, is_published, education, experience_years, teaching_since, languages, intro_video_url, exam_results, gender";

function hasMissingProfileColumns(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: unknown; message?: unknown };
  const code = typeof maybe.code === "string" ? maybe.code : "";
  const message = typeof maybe.message === "string" ? maybe.message : "";
  return code === "42703" || /column\s+"?(university|highschool|target_students|academic_summary|qualifications_summary)"?\s+does\s+not\s+exist/i.test(message);
}

async function withTutorSelectFallback<T>(
  run: (selectCols: string) => Promise<{ data: T | null; error: unknown }>,
): Promise<T> {
  const first = await run(SELECT_COLS);
  if (!first.error) return (first.data ?? ([] as unknown as T));
  if (!hasMissingProfileColumns(first.error)) throw first.error;

  const second = await run(LEGACY_SELECT_COLS);
  if (second.error) throw second.error;
  return (second.data ?? ([] as unknown as T));
}

function normalize(row: Record<string, unknown>): Tutor {
  const edu = Array.isArray(row.education) ? (row.education as Education[]) : [];
  const exams = normalizeExamResults(row.exam_results);
  const targetStudents = Array.isArray(row.target_students)
    ? (row.target_students as unknown[]).filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  return {
    ...(row as unknown as Tutor),
    university: typeof row.university === "string" ? row.university : null,
    highschool: typeof row.highschool === "string" ? row.highschool : null,
    academic_summary: typeof row.academic_summary === "string" ? row.academic_summary : null,
    qualifications_summary: typeof row.qualifications_summary === "string" ? row.qualifications_summary : null,
    education: edu,
    exam_results: exams,
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
  const data = await withTutorSelectFallback<Record<string, unknown>[]>((selectCols) =>
    supabase
      .from("tutors")
      .select(selectCols)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(limit),
  );
  return (data ?? []).map(normalize);
}

export async function fetchPublishedTutors(): Promise<Tutor[]> {
  const data = await withTutorSelectFallback<Record<string, unknown>[]>((selectCols) =>
    supabase
      .from("tutors")
      .select(selectCols)
      .eq("is_published", true)
      .order("created_at", { ascending: false }),
  );
  return (data ?? []).map(normalize);
}

export async function fetchAllTutors(): Promise<Tutor[]> {
  const data = await withTutorSelectFallback<Record<string, unknown>[]>((selectCols) =>
    supabase.from("tutors").select(selectCols).order("created_at", { ascending: false }),
  );
  return (data ?? []).map(normalize);
}

export async function fetchTutorByCode(code: string): Promise<Tutor | null> {
  const data = await withTutorSelectFallback<Record<string, unknown> | null>((selectCols) =>
    supabase
      .from("tutors")
      .select(selectCols)
      .eq("tutor_code", code)
      .eq("is_published", true)
      .maybeSingle(),
  );
  return data ? normalize(data as Record<string, unknown>) : null;
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

export async function fetchLandingStats(): Promise<{ activeTutors: number; subjectsCovered: number }> {
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
