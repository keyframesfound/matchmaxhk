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
  subjects: string[];
  district: string | null;
  lesson_mode: "online" | "in_person" | "either";
  hourly_rate: number;
  badge: string | null;
  bio: string | null;
  photo_url: string | null;
  tutor_code: string;
  rating: number;
  review_count: number;
  weekly_rating: number;
  weekly_score: number;
  is_published: boolean;
  education: Education[];
  experience_years: number | null;
  teaching_since: number | null;
  languages: string[];
  intro_video_url: string | null;
  exam_results: ExamResult[];
};

const SELECT_COLS =
  "id, display_name, headline, subjects, district, lesson_mode, hourly_rate, badge, bio, photo_url, tutor_code, rating, review_count, weekly_rating, weekly_score, is_published, education, experience_years, teaching_since, languages, intro_video_url, exam_results";

function normalize(row: Record<string, unknown>): Tutor {
  const edu = Array.isArray(row.education) ? (row.education as Education[]) : [];
  const exams = normalizeExamResults(row.exam_results);
  return { ...(row as unknown as Tutor), education: edu, exam_results: exams };
}

export async function fetchTopWeeklyTutors(limit = 3): Promise<Tutor[]> {
  const { data, error } = await supabase
    .from("tutors")
    .select(SELECT_COLS)
    .eq("is_published", true)
    .order("weekly_score", { ascending: false })
    .order("weekly_rating", { ascending: false })
    .order("rating", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(normalize);
}

export async function fetchPublishedTutors(): Promise<Tutor[]> {
  const { data, error } = await supabase
    .from("tutors")
    .select(SELECT_COLS)
    .eq("is_published", true)
    .order("rating", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalize);
}

export async function fetchAllTutors(): Promise<Tutor[]> {
  const { data, error } = await supabase
    .from("tutors")
    .select(SELECT_COLS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalize);
}

export async function fetchTutorByCode(code: string): Promise<Tutor | null> {
  const { data, error } = await supabase
    .from("tutors")
    .select(SELECT_COLS)
    .eq("tutor_code", code)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw error;
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
  const { data, error } = await supabase
    .from("tutors")
    .select("subjects")
    .eq("is_published", true);
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
  "Central", "Sheung Wan", "Wan Chai", "Causeway Bay", "North Point", "Quarry Bay",
  "Tsim Sha Tsui", "Mong Kok", "Kowloon Tong", "Kowloon Bay", "Ho Man Tin",
  "Sha Tin", "Tai Po", "Tuen Mun", "Yuen Long", "Tseung Kwan O", "Tung Chung", "Discovery Bay",
];
