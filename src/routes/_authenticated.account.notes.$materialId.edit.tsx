import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { useAuth } from "@/features/auth/useAuth";
import { getMyMaterials } from "@/features/materials/note-drafts.functions";
import { NoteEditorForm } from "@/features/materials/note-editor-form";

/**
 * P9 (#289): edit a live (or any) note. Price/text changes go live after
 * the contact filter; a replaced PDF is staged for staff review and the
 * old file stays on sale until approval.
 */

export const Route = createFileRoute("/_authenticated/account/notes/$materialId/edit")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Edit note | MatchMax" }, { name: "robots", content: "noindex" }],
  }),
  component: EditNotePage,
});

function EditNotePage() {
  const { materialId } = Route.useParams() as { materialId: string };
  const { t } = useTranslation();
  const { user } = useAuth();

  const materialsQuery = useQuery({
    queryKey: ["account", "my-materials", user?.id],
    queryFn: () => getMyMaterials(),
    enabled: Boolean(user),
  });

  const existing = materialsQuery.data?.find((m) => m.id === materialId) ?? null;
  const notFound = !materialsQuery.isLoading && materialsQuery.isSuccess && !existing;

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--background)]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold tracking-normal">{t("notes.form.edit_title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("notes.form.edit_subtitle")}</p>
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 sm:p-8">
          {materialsQuery.isLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : notFound ? (
            <p className="text-sm text-muted-foreground">{t("notes.form.not_found")}</p>
          ) : existing ? (
            <NoteEditorForm existing={existing} />
          ) : (
            <p className="text-sm text-muted-foreground">{t("orders.sign_in_required")}</p>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
