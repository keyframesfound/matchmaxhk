import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PageContainer } from "@/components/layout/PageContainer";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/useAuth";
import { claimByosInvite, getByosInvitePreview } from "@/features/cases/byos.functions";

/**
 * #783 §2.4: BYOS one-time invite landing. Anyone with the link sees a short
 * preview (tutor name, subject, level, rate); claiming requires sign-in, then
 * opens a BYOS_DIRECT case with the admin fee waived — or explains why the
 * waiver is refused (prior on-platform contact with this tutor).
 */
export const Route = createFileRoute("/invite/case/$token")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Your tutor invited you | MatchMax" }, { name: "robots", content: "noindex" }],
  }),
  component: ByosInvitePage,
});

// Static locale map so the i18n guard sees every key.
const REFUSAL_KEYS = {
  not_found: "byos.refused_not_found",
  not_active: "byos.refused_not_active",
  own_invite: "byos.refused_own_invite",
  prior_contact: "byos.refused_prior_contact",
} as const;

function ByosInvitePage() {
  const { t } = useTranslation();
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const preview = useQuery({
    queryKey: ["byos", "preview", token],
    queryFn: () => getByosInvitePreview({ data: { token } }),
  });

  const claim = useMutation({
    mutationFn: () => claimByosInvite({ data: { token } }),
    onSuccess: (result) => {
      if (result.outcome === "claimed") {
        void navigate({ to: "/account/cases/$caseId", params: { caseId: result.caseId } });
      }
    },
  });

  const refusal = claim.data?.outcome === "refused" ? claim.data.reason : null;
  const data = preview.data;

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <SiteHeader />
      <PageContainer>
        <div className="mx-auto max-w-lg py-10">
          {preview.isLoading ? (
            <Skeleton className="h-48 w-full rounded-2xl" />
          ) : !data || !data.found ? (
            <p className="rounded-2xl border border-[color:var(--ink)]/10 p-6 text-sm">
              {t("byos.refused_not_found")}
            </p>
          ) : (
            <section className="space-y-4 rounded-2xl border border-[color:var(--ink)]/10 p-6">
              <div className="flex items-start gap-3">
                <UserPlus
                  className="mt-1 h-5 w-5 shrink-0 text-[color:var(--primary)]"
                  aria-hidden
                />
                <div>
                  <h1 className="text-xl font-semibold text-[color:var(--ink)]">
                    {t("byos.landing_title", { tutor: data.tutorName })}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {data.subject}
                    {data.level ? ` · ${data.level}` : ""} · HK$
                    {data.hourlyRateHkd.toFixed(0)}/h
                  </p>
                </div>
              </div>
              <p className="text-sm">{t("byos.landing_body")}</p>
              <p className="text-xs text-muted-foreground">{t("byos.landing_rule")}</p>

              {!data.active ? (
                <p className="rounded-lg bg-[color:var(--ink)]/5 p-3 text-sm">
                  {t("byos.refused_not_active")}
                </p>
              ) : refusal ? (
                <div className="space-y-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  <p>{t(REFUSAL_KEYS[refusal])}</p>
                  {refusal === "prior_contact" ? (
                    <Button asChild variant="outline" size="sm">
                      <Link to="/case-request">{t("byos.request_normally")}</Link>
                    </Button>
                  ) : null}
                </div>
              ) : loading ? null : !user ? (
                <Button asChild className="w-full font-bold">
                  <Link to="/auth" search={{ redirect: `/invite/case/${token}` }}>
                    {t("byos.sign_in_to_claim")}
                  </Link>
                </Button>
              ) : (
                <Button
                  className="w-full font-bold"
                  disabled={claim.isPending}
                  onClick={() => claim.mutate()}
                >
                  {claim.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  ) : null}
                  {t("byos.claim")}
                </Button>
              )}
              {claim.isError ? (
                <p className="text-sm text-red-700">{t("byos.error_generic")}</p>
              ) : null}
            </section>
          )}
        </div>
      </PageContainer>
      <SiteFooter />
    </div>
  );
}
