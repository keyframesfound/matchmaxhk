import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/useAuth";
import {
  acceptChildClaim,
  getChildClaimPreview,
  type ChildClaimPreview,
} from "@/features/children/claim.functions";

export const Route = createFileRoute("/_authenticated/account/claim-child")({
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    ...(typeof search.token === "string" && search.token.length >= 10 && search.token.length <= 200
      ? { token: search.token }
      : {}),
  }),
  ssr: false,
  head: () => ({
    meta: [
      { title: "Claim your learner profile | MatchMax" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClaimChildPage,
});

// §15.6 empty-state copy per state; valid falls through to the preview card.
const STATE_KEYS: Record<string, { title: string; body: string }> = {
  not_found: { title: "invalid_title", body: "invalid_body" },
  expired: { title: "expired_title", body: "expired_body" },
  used: { title: "used_title", body: "used_body" },
  revoked: { title: "expired_title", body: "expired_body" },
};

function ClaimChildPage() {
  const { token } = Route.useSearch();
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [acceptedNickname, setAcceptedNickname] = useState<string | null>(null);

  const previewQuery = useQuery({
    queryKey: ["account", "claim-child", token],
    enabled: Boolean(token),
    queryFn: () => getChildClaimPreview({ data: { token: token ?? "" } }),
  });

  const accept = useMutation({
    mutationFn: () => acceptChildClaim({ data: { token: token ?? "" } }),
    onSuccess: (res) => {
      setAcceptedNickname(res.nickname);
      toast.success(t("children.claim.accepted_toast", { name: res.nickname }));
      void queryClient.invalidateQueries({ queryKey: ["account", "children"] });
    },
    onError: (e) => {
      const key = `children.claim.err_${e.message}`;
      toast.error(t(key, { defaultValue: t("children.claim.error") }));
      void queryClient.invalidateQueries({ queryKey: ["account", "claim-child", token] });
    },
  });

  const preview: ChildClaimPreview | undefined = previewQuery.data;

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <SiteHeader />
      <PageContainer>
        <div className="mx-auto max-w-lg py-10">
          {!token || (preview && preview.state !== "valid") ? (
            <div className="rounded-[var(--radius-panel)] border border-border bg-card p-6">
              <h1 className="text-xl font-bold text-[color:var(--ink)]">
                {t(`children.claim.${STATE_KEYS[preview?.state ?? "not_found"]?.title}`)}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {t(`children.claim.${STATE_KEYS[preview?.state ?? "not_found"]?.body}`)}
              </p>
            </div>
          ) : acceptedNickname ? (
            <div className="rounded-[var(--radius-panel)] border border-border bg-card p-6">
              <h1 className="text-xl font-bold text-[color:var(--ink)]">
                {t("children.claim.done_title", { name: acceptedNickname })}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{t("children.claim.done_body")}</p>
              <Button className="mt-4 font-bold" onClick={() => navigate({ to: "/account" })}>
                {t("children.claim.done_cta")}
              </Button>
            </div>
          ) : loading || previewQuery.isLoading || !preview ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : !user ? (
            <div className="rounded-[var(--radius-panel)] border border-border bg-card p-6">
              <h1 className="text-xl font-bold text-[color:var(--ink)]">
                {t("children.claim.sign_in_title")}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("children.claim.sign_in_body")}
              </p>
            </div>
          ) : (
            <div className="rounded-[var(--radius-panel)] border border-border bg-card p-6">
              <h1 className="text-xl font-bold text-[color:var(--ink)]">
                {t("children.claim.title", { name: preview.nickname ?? "" })}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{t("children.claim.body")}</p>
              {preview.verifiedHours != null && preview.verifiedHours > 0 ? (
                <p className="mt-3 text-sm font-semibold text-[color:var(--ink)]">
                  {t("children.claim.hours", { hours: preview.verifiedHours })}
                </p>
              ) : null}
              <p className="mt-3 text-xs text-muted-foreground">
                {t("children.claim.self_parent_note")}
              </p>
              <Button
                className="mt-4 font-bold"
                disabled={accept.isPending}
                onClick={() => accept.mutate()}
              >
                {accept.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("children.claim.confirm")}
              </Button>
            </div>
          )}
        </div>
      </PageContainer>
      <SiteFooter />
    </div>
  );
}
