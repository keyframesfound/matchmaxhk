import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_TUTOR_TIMEZONE, resolveTutorTimezone } from "@/features/cases/tutor-timezone";
import { useAuth } from "@/features/auth/useAuth";

/**
 * #798: the signed-in tutor's stored zone, shared with the settings picker
 * (same query key, so opening Settings warms this and a save updates it).
 *
 * Resolves to HKT whenever the row has no usable value, so every caller can
 * keep rendering while the read is in flight or the account owns no card.
 */
export function useMyTutorTimezone(): string {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const { data } = useQuery({
    queryKey: ["settings", "tutor-timezone", userId],
    enabled: userId !== "",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutors")
        .select("timezone" as never)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return resolveTutorTimezone((data as { timezone?: string | null } | null)?.timezone ?? null);
    },
  });

  return data ?? DEFAULT_TUTOR_TIMEZONE;
}
