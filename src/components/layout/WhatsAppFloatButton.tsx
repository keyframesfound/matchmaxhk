import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export function WhatsAppFloatButton() {
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
    staleTime: 5 * 60 * 1000,
  });

  const digits = whatsappNumber.replace(/[^\d]/g, "");
  if (!digits) return null;

  const message = "Hi MatchMax, I need support.";
  const href = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Contact MatchMax support on WhatsApp"
      className="fixed bottom-4 right-4 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_14px_28px_rgba(0,0,0,0.24)] transition-transform duration-200 hover:scale-105 hover:bg-[#1ebe57] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-navy)] focus-visible:ring-offset-2 sm:bottom-6 sm:right-6"
    >
      <MessageCircle className="h-7 w-7" aria-hidden />
      <span className="sr-only">WhatsApp support</span>
    </a>
  );
}