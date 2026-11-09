import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Loader2, UserRoundPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/useAuth";
import { getConnectionStatus } from "@/features/connections/connections.functions";
import { ConnectRequestModal } from "@/features/connections/connect-request-modal";
import { isWithinCooldown } from "@/features/connections/connections-pure";

/**
 * #617: the [Connect / 連結] button on a PUBLIC tutor profile, rendered only
 * for a signed-in, tier_2_verified tutor viewing another verified tutor's
 * live card. Self-views and anonymous/parent/unverified visitors see
 * nothing (the API 400 on self-connect stays as the server-side backstop).
 * Existing edges render their state instead of the CTA.
 */
export function ConnectTutorButton({
  targetTutorId,
  targetUserId,
  targetName,
  targetVerified,
}: {
  targetTutorId: string;
  targetUserId: string | null;
  targetName: string;
  targetVerified: boolean;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);

  const myTutorQuery = useQuery({
    queryKey: ["account", "connect-my-tutor", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutors")
        .select("id, verification_tier")
        .eq("user_id", user?.id ?? "")
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; verification_tier: string | null } | null;
    },
    enabled: Boolean(user) && user?.id !== targetUserId && targetVerified,
  });

  const myTutor = myTutorQuery.data;
  const eligible =
    Boolean(user) &&
    user?.id !== targetUserId &&
    targetVerified &&
    myTutor != null &&
    myTutor.verification_tier === "tier_2_verified";

  const statusQuery = useQuery({
    queryKey: ["connections", "status", targetTutorId],
    queryFn: () => getConnectionStatus({ data: { tutorId: targetTutorId } }),
    enabled: eligible,
    staleTime: 30_000,
  });

  if (!eligible) return null;
  if (myTutorQuery.isLoading || statusQuery.isLoading) {
    return (
      <div className="mt-3 flex h-10 w-40 items-center justify-center rounded-sm border border-border">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }
  if (!statusQuery.data?.verified) return null;

  const status = statusQuery.data.status;
  const direction = statusQuery.data.direction;
  const inCooldown =
    status === "DECLINED" && isWithinCooldown(statusQuery.data.cooldownUntil, new Date());

  let button: React.ReactNode;
  if (status === "ACCEPTED") {
    button = (
      <Button variant="outline" disabled className="mt-3 w-full rounded-sm font-bold sm:w-auto">
        {t("connections.connected_label")}
      </Button>
    );
  } else if (status === "PENDING" && direction === "outbound") {
    button = (
      <Button variant="outline" disabled className="mt-3 w-full rounded-sm font-bold sm:w-auto">
        {t("connections.requested")}
      </Button>
    );
  } else if (status === "PENDING" && direction === "inbound") {
    button = (
      <Button variant="outline" asChild className="mt-3 w-full rounded-sm font-bold sm:w-auto">
        <Link to="/account/connections" search={{ tab: "pending" }}>
          {t("connections.respond")}
        </Link>
      </Button>
    );
  } else if (inCooldown) {
    // Generic disabled state until the 30-day cooldown expires (#617).
    button = (
      <Button
        variant="outline"
        disabled
        title={t("connections.error.cooldown")}
        className="mt-3 w-full rounded-sm font-bold sm:w-auto"
      >
        {t("connections.connect")}
      </Button>
    );
  } else {
    // none / DECLINED past cooldown / DISCONNECTED → the CTA opens the modal.
    button = (
      <Button
        variant="outline"
        className="mt-3 w-full rounded-sm font-bold sm:w-auto"
        onClick={() => setModalOpen(true)}
      >
        <UserRoundPlus className="mr-2 h-4 w-4" aria-hidden />
        {t("connections.connect")}
      </Button>
    );
  }

  return (
    <>
      {button}
      <ConnectRequestModal
        target={{ id: targetTutorId, display_name: targetName }}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  );
}
