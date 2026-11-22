import { useQuery } from "@tanstack/react-query";
import { Handshake } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppNumber } from "@/lib/use-whatsapp-number";
import { conciergeReferMessage } from "@/features/connections/concierge-refer";

/**
 * #797 §2.4 (was #618, Wave 1): "Refer / Partner via Concierge". A thin
 * button that opens a pre-filled WhatsApp to the official Ops desk. No in-app
 * thread, no composer, and the other tutor's phone / email / WhatsApp is never
 * revealed. Shown only to a signed-in verified tutor looking at another tutor.
 */
export function ConciergeReferButton({
  targetCode,
  targetUserId,
  size = "sm",
  className,
}: {
  targetCode: string;
  targetUserId: string | null;
  size?: "sm" | "default";
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const notSelf = Boolean(user) && user?.id !== targetUserId;
  const me = useQuery({
    queryKey: ["connections", "concierge-me", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tutors")
        .select("tutor_code, verification_tier")
        .eq("user_id", user?.id ?? "")
        .maybeSingle();
      return data as { tutor_code: string | null; verification_tier: string | null } | null;
    },
    enabled: notSelf,
    staleTime: 5 * 60_000,
  });
  const digits = useWhatsAppNumber(notSelf);
  if (!notSelf || me.data?.verification_tier !== "tier_2_verified" || !digits) return null;

  const message = conciergeReferMessage({
    language: i18n.language,
    targetCode,
    myCode: me.data?.tutor_code ?? null,
  });
  return (
    <Button asChild size={size} className={className}>
      <a
        href={`https://wa.me/${digits}?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Handshake aria-hidden className="h-4 w-4" />
        {t("connections.concierge_refer")}
      </a>
    </Button>
  );
}
