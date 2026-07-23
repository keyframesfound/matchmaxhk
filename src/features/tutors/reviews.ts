import { supabase } from "@/integrations/supabase/client";

export type TutorReview = {
  id: string;
  tutor_id: string;
  author_user_id: string | null;
  author_alias: string;
  rating: number;
  comment: string | null;
  is_published: boolean;
  created_at: string;
};

const COLS =
  "id, tutor_id, author_user_id, author_alias, rating, comment, is_published, created_at";

export async function fetchReviewsForTutor(tutorId: string): Promise<TutorReview[]> {
  const { data, error } = await supabase
    .from("tutor_reviews")
    .select(COLS)
    .eq("tutor_id", tutorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TutorReview[];
}
