import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/useAuth";
import type { TutorMatchProfile } from "@/features/cases/case-best-match";

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;

/**
 * #699: the signed-in tutor's own matching fields (their own row is readable
 * under RLS). `null` for guests, parents and tutors without a profile row.
 */
export function useTutorMatchProfile(): {
  profile: TutorMatchProfile | null;
  isTutor: boolean;
  isLoading: boolean;
} {
  const { user, hasRole } = useAuth();
  const isTutor = Boolean(user && hasRole("tutor"));
  const query = useQuery({
    queryKey: ["cases", "tutor-match-profile", user?.id],
    enabled: isTutor,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TutorMatchProfile | null> => {
      const { data, error } = await supabase
        .from("tutors")
        .select(
          "subjects, target_students, lesson_mode, stations, district, gender, tutor_status, profile_tags",
        )
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error || !data) return null;
      const row = data as unknown as Record<string, unknown>;
      return {
        subjects: strings(row.subjects),
        targetStudents: strings(row.target_students),
        lessonMode: text(row.lesson_mode),
        stations: strings(row.stations),
        district: text(row.district),
        gender: text(row.gender),
        tutorStatus: text(row.tutor_status),
        profileTags: strings(row.profile_tags),
      };
    },
  });
  return { profile: query.data ?? null, isTutor, isLoading: isTutor && query.isLoading };
}
