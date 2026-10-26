import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/useAuth";

export const Route = createFileRoute("/_authenticated/account/claim")({
  validateSearch: (search: Record<string, unknown>): { tutor?: string } => ({
    ...(typeof search.tutor === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search.tutor)
      ? { tutor: search.tutor }
      : {}),
  }),
  head: () => ({
    meta: [{ title: "Claim your tutor card | MatchMax" }, { name: "robots", content: "noindex" }],
  }),
  component: ClaimCardPage,
});

type ClaimDecision = "already_owned" | "confirm" | "staff_review";

// Epic #280 P2: a tutor claims their existing card. The RPC decides what the
// caller may do, application-email match → confirm screen; anything else →
// staff review. The client never grants the claim itself.
function ClaimCardPage() {
  const { t } = useTranslation();
  const { tutor: tutorId } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const cardQuery = useQuery({
    queryKey: ["tutor", "claim-card", tutorId],
    enabled: Boolean(tutorId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutors")
        .select("id, display_name, tutor_code, photo_url, headline")
        .eq("id", tutorId ?? "")
        .eq("is_published", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const decisionQuery = useQuery({
    queryKey: ["tutor", "claim-decision", tutorId, user?.id],
    enabled: Boolean(tutorId) && Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("request_tutor_claim", {
        p_tutor_id: tutorId ?? "",
      });
      if (error) throw error;
      return data as ClaimDecision;
    },
  });

  const confirmClaim = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("confirm_tutor_claim", {
        p_tutor_id: tutorId ?? "",
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tutor"] });
      toast.success(t("account.claim.claimed_toast"));
      void navigate({ to: "/account", replace: true });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t("account.claim.error_toast"));
      void decisionQuery.refetch();
    },
  });

  // Already owned → nothing to decide here; Account shows the card.
  useEffect(() => {
    if (decisionQuery.data === "already_owned") {
      void navigate({ to: "/account", replace: true });
    }
  }, [decisionQuery.data, navigate]);

  if (!tutorId || cardQuery.isError) {
    return <ClaimMessage text={t("account.claim.not_found")} backToAccount />;
  }

  if (cardQuery.isLoading || (decisionQuery.isLoading && decisionQuery.fetchStatus !== "idle")) {
    return <PageSkeleton />;
  }

  const card = cardQuery.data;
  if (!card) {
    return <ClaimMessage text={t("account.claim.not_found")} backToAccount />;
  }

  if (decisionQuery.data === "staff_review") {
    return <ClaimMessage text={t("account.claim.staff_review_body")} backToAccount />;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <main className="flex flex-1 flex-col items-center px-4 py-10">
        <div className="w-full max-w-md text-center">
          <Logo className="mx-auto h-14 w-14" imgClassName="h-14 w-14" />
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-[color:var(--ink)]">
            {t("account.claim.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("account.claim.subtitle")}</p>

          <div className="mt-6 rounded-2xl border border-[color:var(--border)] bg-card p-5 text-left">
            <div className="flex items-center gap-4">
              {card.photo_url ? (
                <img
                  src={card.photo_url}
                  alt=""
                  className="h-14 w-14 rounded-full object-cover"
                  loading="lazy"
                />
              ) : null}
              <div className="min-w-0">
                <p className="truncate font-bold text-[color:var(--ink)]">{card.display_name}</p>
                <p className="text-sm text-muted-foreground">{card.tutor_code}</p>
              </div>
            </div>
            {card.headline ? (
              <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{card.headline}</p>
            ) : null}
          </div>

          <div className="mt-6 flex gap-3">
            <Button
              variant="outline"
              className="h-11 flex-1 rounded-xl font-bold"
              onClick={() => void navigate({ to: "/account", replace: true })}
              disabled={confirmClaim.isPending}
            >
              {t("account.claim.cancel")}
            </Button>
            <Button
              variant="solid"
              color="blue"
              className="h-11 flex-1 rounded-xl font-bold"
              onClick={() => confirmClaim.mutate()}
              disabled={confirmClaim.isPending}
            >
              {confirmClaim.isPending ? t("account.claim.claiming") : t("account.claim.confirm")}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

function ClaimMessage({ text, backToAccount }: { text: string; backToAccount?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 text-center">
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      {backToAccount ? (
        <Button
          variant="outline"
          className="mt-6 h-11 rounded-xl font-bold"
          onClick={() => void navigate({ to: "/account", replace: true })}
        >
          {t("account.claim.back_to_account")}
        </Button>
      ) : null}
    </div>
  );
}
