import { supabase } from "@/integrations/supabase/client";

export type Education = {
  institution: string;
  qualification: string;
  year?: number | null;
};

export type Tutor = {
  id: string;
  display_name: string;
  headline: string | null;
  subjects: string[];
  district: string | null;
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
};

const SELECT_COLS =
  "id, display_name, headline, subjects, district, hourly_rate, badge, bio, photo_url, tutor_code, rating, review_count, weekly_rating, weekly_score, is_published, education, experience_years, teaching_since, languages, intro_video_url";

function normalize(row: Record<string, unknown>): Tutor {
  const edu = Array.isArray(row.education) ? (row.education as Education[]) : [];
  return { ...(row as unknown as Tutor), education: edu };
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

export const HK_DISTRICTS = [
  "Central", "Sheung Wan", "Wan Chai", "Causeway Bay", "North Point", "Quarry Bay",
  "Tsim Sha Tsui", "Mong Kok", "Kowloon Tong", "Kowloon Bay", "Ho Man Tin",
  "Sha Tin", "Tai Po", "Tuen Mun", "Yuen Long", "Tseung Kwan O", "Tung Chung", "Discovery Bay",
];
