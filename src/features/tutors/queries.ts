import { supabase } from "@/integrations/supabase/client";

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
};

const SELECT_COLS =
  "id, display_name, headline, subjects, district, hourly_rate, badge, bio, photo_url, tutor_code, rating, review_count, weekly_rating, weekly_score, is_published";

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
  return (data ?? []) as Tutor[];
}

export async function fetchPublishedTutors(): Promise<Tutor[]> {
  const { data, error } = await supabase
    .from("tutors")
    .select(SELECT_COLS)
    .eq("is_published", true)
    .order("rating", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Tutor[];
}

export async function fetchAllTutors(): Promise<Tutor[]> {
  const { data, error } = await supabase
    .from("tutors")
    .select(SELECT_COLS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Tutor[];
}

export const HK_DISTRICTS = [
  "Central", "Sheung Wan", "Wan Chai", "Causeway Bay", "North Point", "Quarry Bay",
  "Tsim Sha Tsui", "Mong Kok", "Kowloon Tong", "Kowloon Bay", "Ho Man Tin",
  "Sha Tin", "Tai Po", "Tuen Mun", "Yuen Long", "Tseung Kwan O", "Tung Chung", "Discovery Bay",
];
