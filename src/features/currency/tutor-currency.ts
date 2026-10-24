// Issue #113, the authed tutor's quoting currency for case-feed conversion.
// Parents and non-tutor accounts get HKD (no conversion anywhere).
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/useAuth";
import { DEFAULT_CURRENCY, toCurrencyCode, type CurrencyCode } from "@/lib/money";

export function useTutorDisplayCurrency(): CurrencyCode {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["my-tutor-currency", user?.id],
    queryFn: async (): Promise<CurrencyCode> => {
      const { data: row, error } = await supabase
        .from("tutors")
        .select("currency")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return toCurrencyCode(row?.currency);
    },
    enabled: Boolean(user),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
  return data ?? DEFAULT_CURRENCY;
}
