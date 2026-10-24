import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { useAuth } from "@/features/auth/useAuth";
import { getMyGigs } from "@/features/gigs/gig-drafts.functions";
import { GigEditorForm } from "@/features/gigs/gig-editor-form";

/**
 * #326: edit a freestyle service gig (any status). Submitting again sends
 * it back to staff review; drafts save without gating.
 */

export const Route = createFileRoute("/_authenticated/account/services/$materialId/edit")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Edit service | MatchMax" }, { name: "robots", content: "noindex" }],
  }),
  component: EditServicePage,
});

function EditServicePage() {
  const { materialId } = Route.useParams() as { materialId: string };
  const { t } = useTranslation();
  const { user } = useAuth();

  const gigsQuery = useQuery({
    queryKey: ["account", "my-gigs", user?.id],
    queryFn: () => getMyGigs(),
    enabled: Boolean(user),
  });

  const existing = gigsQuery.data?.find((gig) => gig.id === materialId) ?? null;
  const notFound = !gigsQuery.isLoading && gigsQuery.isSuccess && !existing;

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--background)]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-medium tracking-normal">{t("gigs.form.edit_title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("gigs.form.edit_subtitle")}</p>
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 sm:p-8">
          {gigsQuery.isLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : notFound ? (
            <p className="text-sm text-muted-foreground">{t("gigs.form.not_found")}</p>
          ) : existing ? (
            <GigEditorForm existing={existing} />
          ) : (
            <p className="text-sm text-muted-foreground">{t("orders.sign_in_required")}</p>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
