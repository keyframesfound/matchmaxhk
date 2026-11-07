import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { useAuth } from "@/features/auth/useAuth";
import { SellTypePills } from "@/features/materials/sell-type-pills";
import { GigEditorForm } from "@/features/gigs/gig-editor-form";

/**
 * #326: new freestyle service gig, everything is optional until submit;
 * a draft with only a title survives (mirrors /account/notes/new).
 */

export const Route = createFileRoute("/_authenticated/account/services/new")({
  validateSearch: z.object({ type: z.enum(["marking"]).optional().catch(undefined) }),
  ssr: false,
  head: () => ({
    meta: [{ title: "Add a service | MatchMax" }, { name: "robots", content: "noindex" }],
  }),
  component: NewServicePage,
});

function NewServicePage() {
  const { type } = Route.useSearch();
  const { t } = useTranslation();
  const { user, loading } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--background)]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold tracking-normal">{t("gigs.form.new_title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("gigs.form.new_subtitle")}</p>
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 sm:p-8">
          {loading || !user ? (
            <p className="text-sm text-muted-foreground">{t("orders.sign_in_required")}</p>
          ) : (
            <>
              <SellTypePills active="marking" />
              <GigEditorForm key={type ?? "service"} presetMarking={type === "marking"} />
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
