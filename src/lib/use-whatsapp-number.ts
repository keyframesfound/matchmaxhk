import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * MatchMax hotline number from app_settings ("whatsapp_number"), digits only
 * and ready for wa.me deep links. Empty string while loading or unconfigured.
 */
export function useWhatsAppNumber(enabled = true) {
  const { data: whatsappNumber = "" } = useQuery({
    queryKey: ["settings", "whatsapp_number"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "whatsapp_number")
        .maybeSingle();

      if (error) throw error;
      const value = data?.value;
      return typeof value === "string" ? value.trim() : "";
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
  return whatsappNumber.replace(/[^\d]/g, "");
}
